import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, ExternalLink, Eye, Info, Loader2, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BreachDetailModal } from "@/components/BreachDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { toast } from "@/hooks/use-toast";
import type { BreachCatalogEntry } from "@/hooks/useBreachCatalog";
import { DIRECTORY_PATH, isOpen, payoutLabel, settlementPath } from "@/lib/settlements/format";
import { type AccountMatch, fetchAccountOverview } from "@/lib/account";

type ScanState = "loading" | "idle" | "scanning" | "results";

const sensitivityStyle: Record<string, string> = {
  low: "text-muted-foreground bg-muted border-border",
  medium: "text-warning bg-warning/10 border-warning/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  critical: "text-destructive bg-destructive/10 border-destructive/20",
};

interface BreachResult {
  id: string;
  source: string;
  breach_year: number | null;
  risk_level: string;
  exposed_fields: string[];
  details: Record<string, unknown> | null;
  breach_catalog_id: string | null;
  catalog: BreachCatalogEntry | null;
}

interface ScanSummary {
  id: string;
  completedAt: string | null;
  riskScore: number;
}

/** Stored links point at the breach database's data feed; send people to the readable page instead. */
function breachPageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /^https:\/\/haveibeenpwned\.com\/api\/v3\/breach\/([^/?#]+)$/i.exec(url);
  return m ? `https://haveibeenpwned.com/Breach/${m[1]}` : url;
}

const nextSteps = [
  {
    when: () => true,
    text: "Change the password for each account listed, and anywhere else you used the same password.",
  },
  { when: () => true, text: "Turn on two-step sign-in wherever it's offered, starting with your email account." },
  {
    when: (fields: string[]) => fields.some((f) => /social security|credit card|bank|financial|passport|government/i.test(f)),
    text: "Because financial or identity details were exposed, consider a free credit freeze with Equifax, Experian and TransUnion.",
  },
  { when: () => true, text: "Be wary of emails or calls that mention these companies. Breached data is often used for phishing." },
];

const Scan = () => {
  const { user } = useAuth();
  const track = useTrackEvent();
  const [state, setState] = useState<ScanState>("loading");
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [breaches, setBreaches] = useState<BreachResult[]>([]);
  const [matches, setMatches] = useState<AccountMatch[]>([]);
  const [selectedBreach, setSelectedBreach] = useState<BreachCatalogEntry | null>(null);

  const loadResults = useCallback(
    async (scan: ScanSummary) => {
      if (!user) return;
      const [breachRes, overview] = await Promise.all([
        supabase
          .from("breach_events")
          .select("*, breach_catalog(id, name, company, breach_year, severity, exposed_fields, data_types, records_exposed, verified, verification_status, source_type, source_name, source_url, tags, active, settlement_available, settlement_name, estimated_payout_min, estimated_payout_max, claim_deadline, law_firm_partner, created_at, updated_at)")
          .eq("scan_run_id", scan.id),
        fetchAccountOverview(user.id),
      ]);

      setBreaches(
        ((breachRes.data ?? []) as unknown as Array<BreachResult & { breach_catalog: BreachCatalogEntry | null }>).map((b) => ({ ...b, catalog: b.breach_catalog ?? null })),
      );
      // Same list as My matches: real breach checks only, approved listings, open for claims.
      setMatches(overview.matches.filter((m) => isOpen(m.settlement)));
      setSummary(scan);
      setState("results");
    },
    [user],
  );

  // Show the most recent check, if there is one, so results are always a click away.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("scan_runs")
        .select("id, completed_at, risk_score")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .eq("provider", "hibp")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) await loadResults({ id: data.id, completedAt: data.completed_at, riskScore: data.risk_score ?? 0 });
      else setState("idle");
    })().catch(() => !cancelled && setState("idle"));
    return () => {
      cancelled = true;
    };
  }, [user, loadResults]);

  const runCheck = async () => {
    if (!user) return;
    setState("scanning");
    track("scan_started", { mode: "live" });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hibp-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
        },
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 429) {
        toast({
          title: "Please wait a little",
          description: body.error || "A check was run recently. Try again in a few minutes.",
        });
        setState(summary ? "results" : "idle");
        return;
      }
      if (!response.ok || !body.scan_run_id) throw new Error(body.error || `The check failed (${response.status}).`);

      track("scan_completed", { scan_run_id: body.scan_run_id, breaches: body.breaches_found, risk_score: body.risk_score });
      await loadResults({ id: body.scan_run_id, completedAt: new Date().toISOString(), riskScore: body.risk_score ?? 0 });
    } catch (error) {
      console.error("Breach check failed:", error);
      toast({
        title: "The check didn't finish",
        description: "Nothing was changed. Please try again in a moment.",
        variant: "destructive",
      });
      setState(summary ? "results" : "idle");
    }
  };

  const matchFor = (breach: BreachResult) =>
    matches.find((m) => (m.reason ?? "").toLowerCase().includes(breach.source.toLowerCase()));

  const allFields = breaches.flatMap((b) => b.exposed_fields ?? []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Breach check" subtitle="See which known data breaches include your email address" />

      {state === "loading" && (
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {(state === "idle" || state === "scanning") && (
        <div className="glass-card-glow mx-auto max-w-lg p-6 sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Search className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <h2 className="text-center text-lg font-bold">Check your email for known breaches</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We'll look up <span className="font-medium text-foreground">{user?.email}</span> in the Have I Been Pwned
            database, then show any listed settlements that may be related.
          </p>

          <Button onClick={runCheck} disabled={state === "scanning"} className="mt-6 h-12 w-full rounded-xl text-base">
            {state === "scanning" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Checking…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" aria-hidden /> Run the check
              </>
            )}
          </Button>

          <ul className="mt-6 space-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <li>Only your account email is checked. To check another address, sign up with it.</li>
            <li>Results are saved to your account so you can come back to them.</li>
            <li>No database covers every breach, so a clean result isn't a guarantee.</li>
          </ul>
        </div>
      )}

      {state === "results" && summary && (
        <div className="space-y-6">
          <section className="glass-card p-6" aria-labelledby="result-heading">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <h2 id="result-heading" className="text-lg font-bold">
                  {breaches.length > 0
                    ? `${breaches.length} known breach${breaches.length === 1 ? "" : "es"} include your email`
                    : "No known breaches include your email"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user?.email} · Source: Have I Been Pwned
                  {summary.completedAt && ` · Checked ${formatDistanceToNow(new Date(summary.completedAt), { addSuffix: true })}`}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold">{breaches.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Breaches found</p>
              </div>
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold">
                  {summary.riskScore}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Exposure score</p>
              </div>
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">{matches.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Possible settlement matches</p>
              </div>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              The exposure score is a rough guide based on how many breaches were found and what kind of data they
              exposed. It is not a credit score and does not predict fraud.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {matches.length > 0 ? (
                <Button asChild className="rounded-xl">
                  <Link to="/settlements">
                    <Eye className="mr-2 h-4 w-4" aria-hidden /> See my matches
                  </Link>
                </Button>
              ) : (
                <Button asChild className="rounded-xl">
                  <Link to={DIRECTORY_PATH}>Browse open settlements</Link>
                </Button>
              )}
              <Button variant="outline" onClick={runCheck} className="rounded-xl">
                Run again
              </Button>
            </div>
          </section>

          {breaches.length > 0 && (
            <section aria-labelledby="breaches-heading">
              <h2 id="breaches-heading" className="mb-3 text-lg font-semibold">
                Breaches that include your email
              </h2>
              <div className="space-y-3">
                {breaches.map((breach) => {
                  const match = matchFor(breach);
                  const settlement = match?.settlement ?? null;
                  const sourceUrl = breachPageUrl(breach.catalog?.source_url);
                  const records = breach.catalog?.records_exposed ?? (breach.details?.pwn_count as number | undefined);
                  const listed = settlement ? payoutLabel(settlement) : null;

                  return (
                    <article key={breach.id} className="glass-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold">{breach.source}</h3>
                        <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${sensitivityStyle[breach.risk_level] ?? sensitivityStyle.low}`}>
                          Data sensitivity: {breach.risk_level}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {breach.breach_year ? `Breach year: ${breach.breach_year}` : "Breach year unknown"}
                        {records ? ` · ${Number(records).toLocaleString()} accounts affected` : ""}
                        {sourceUrl && (
                          <>
                            {" · "}
                            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                              Source <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          </>
                        )}
                      </p>

                      {breach.exposed_fields?.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs text-muted-foreground">Data exposed in this breach:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {breach.exposed_fields.map((field) => (
                              <span key={field} className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 border-t border-border pt-3">
                        {settlement ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm">
                              <span className="text-muted-foreground">Possibly related settlement: </span>
                              <span className="font-medium">{settlement.name}</span>
                              {listed && <span className="text-muted-foreground"> · listed payout {listed.replace(/^Up to/, "up to")}</span>}
                            </p>
                            <Button asChild size="sm" className="rounded-xl">
                              <Link
                                to={settlementPath(settlement)}
                                onClick={() => track("match_viewed", { match_id: match?.id, settlement_id: settlement.id })}
                              >
                                View settlement <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No listed settlement matches this breach right now.</p>
                        )}
                        {breach.catalog && (
                          <Button size="sm" variant="ghost" className="mt-2 rounded-xl px-2 text-xs" onClick={() => setSelectedBreach(breach.catalog)}>
                            <Eye className="mr-1 h-3 w-3" aria-hidden /> Breach details
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {breaches.length > 0 && (
            <section className="glass-card p-6" aria-labelledby="next-heading">
              <h2 id="next-heading" className="text-lg font-semibold">
                What to do now
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {nextSteps.filter((s) => s.when(allFields)).map((s) => (
                  <li key={s.text}>{s.text}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        A match means a listed settlement involves a company from your results. It does not mean you are eligible: the
        settlement administrator decides that. BreachPay is not a law firm and does not provide legal advice.
      </p>

      <BreachDetailModal breach={selectedBreach} open={!!selectedBreach} onOpenChange={(open) => !open && setSelectedBreach(null)} />
    </div>
  );
};

export default Scan;
