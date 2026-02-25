import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Shield, AlertTriangle, Loader2, Crown, Check, Eye, DollarSign, Zap, Bell, Activity, ArrowRight, ExternalLink, BadgeCheck, Clock, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { BreachDetailModal } from "@/components/BreachDetailModal";
import type { BreachCatalogEntry } from "@/hooks/useBreachCatalog";

type ScanState = "idle" | "scanning" | "results";

const severityColor: Record<string, string> = {
  low: "text-warning bg-warning/10 border-warning/20",
  medium: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  high: "text-destructive bg-destructive/10 border-destructive/20",
  critical: "text-destructive bg-destructive/10 border-destructive/20",
};

interface CatalogInfo extends Partial<BreachCatalogEntry> {
  verified: boolean;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
}

interface BreachResult {
  id: string;
  source: string;
  breach_year: number | null;
  risk_level: string;
  exposed_fields: string[];
  record_count_estimate: number | null;
  details: any;
  breach_catalog_id: string | null;
  catalog?: CatalogInfo | null;
}

interface MatchResult {
  id: string;
  settlement_id: string;
  payout_estimate: number | null;
  settlement: {
    id: string;
    name: string;
    company: string;
    payout_min: number | null;
    payout_max: number | null;
    status: string;
  } | null;
}

interface ScanMeta {
  lastScanAt: string | null;
  nextScanAt: string | null;
  scanStartedAt: string | null;
  scanCompletedAt: string | null;
  databasesScanned: number;
  isScheduled: boolean;
}

const Scan = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ScanState>("idle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [breaches, setBreaches] = useState<BreachResult[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [scanRunId, setScanRunId] = useState<string | null>(null);
  const [selectedCatalogBreach, setSelectedCatalogBreach] = useState<BreachCatalogEntry | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [scanMeta, setScanMeta] = useState<ScanMeta>({
    lastScanAt: null,
    nextScanAt: null,
    scanStartedAt: null,
    scanCompletedAt: null,
    databasesScanned: 0,
    isScheduled: false,
  });

  // Load user profile for premium status + scan schedule
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("plan, last_scan_at, next_scan_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsPremium(data.plan === "premium");
          setScanMeta(prev => ({
            ...prev,
            lastScanAt: data.last_scan_at,
            nextScanAt: data.next_scan_at,
          }));
        }
      });
  }, [user]);

  // Poll for scan completion
  useEffect(() => {
    if (state !== "scanning" || !scanRunId) return;

    const interval = setInterval(async () => {
      const { data: scan } = await supabase
        .from("scan_runs")
        .select("status, risk_score, breaches_detected, eligible_settlements, started_at, completed_at, databases_scanned")
        .eq("id", scanRunId)
        .maybeSingle();

      if (scan && (scan.status === "completed" || scan.status === "failed")) {
        clearInterval(interval);
        if (scan.status === "failed") {
          toast({ title: "Scan Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
          setState("idle");
          return;
        }

        setRiskScore(scan.risk_score);
        setScanMeta(prev => ({
          ...prev,
          scanStartedAt: scan.started_at,
          scanCompletedAt: scan.completed_at,
          databasesScanned: scan.databases_scanned || 0,
          isScheduled: false,
        }));

        // Fetch breaches for this scan with catalog join (including new fields)
        const { data: breachData } = await supabase
          .from("breach_events")
          .select("*, breach_catalog(id, name, company, breach_year, severity, exposed_fields, data_types, records_exposed, verified, verification_status, source_type, source_name, source_url, tags, active, settlement_available, settlement_name, estimated_payout_min, estimated_payout_max, claim_deadline, law_firm_partner, created_at, updated_at)")
          .eq("scan_run_id", scanRunId);

        if (breachData) {
          setBreaches(breachData.map((b: any) => ({
            ...b,
            catalog: b.breach_catalog || null,
          })));
        }

        // Fetch settlement matches for this user
        const { data: matchData } = await supabase
          .from("settlement_matches")
          .select("id, settlement_id, payout_estimate, settlements(id, name, company, payout_min, payout_max, status)")
          .eq("user_id", user!.id);

        if (matchData) {
          setMatches(matchData.map((m: any) => ({
            ...m,
            settlement: m.settlements,
          })));
        }

        // Refresh profile scan times
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("last_scan_at, next_scan_at")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (profile) {
          setScanMeta(prev => ({
            ...prev,
            lastScanAt: profile.last_scan_at,
            nextScanAt: profile.next_scan_at,
          }));
        }

        setState("results");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state, scanRunId, user]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setState("scanning");

    // Enable monitoring + trigger scan via edge function
    await supabase
      .from("user_profiles")
      .update({ monitoring_enabled: true, next_scan_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Call the run-scheduled-scans edge function
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/run-scheduled-scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Find the scan run that was just created
      const { data: latestScan } = await supabase
        .from("scan_runs")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestScan) {
        setScanRunId(latestScan.id);
      } else {
        // Fallback: wait and retry
        setTimeout(async () => {
          const { data: retryScan } = await supabase
            .from("scan_runs")
            .select("id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (retryScan) setScanRunId(retryScan.id);
        }, 3000);
      }
    } catch (error) {
      toast({ title: "Scan Error", description: "Failed to start scan. Please try again.", variant: "destructive" });
      setState("idle");
    }
  };

  const reset = () => {
    setState("idle");
    setEmail("");
    setPhone("");
    setBreaches([]);
    setMatches([]);
    setScanRunId(null);
  };

  const eligibleMatches = matches.filter(m => m.settlement && (m.settlement.status === "open" || m.settlement.status === "pending"));
  const estMin = eligibleMatches.reduce((sum, m) => sum + (m.settlement?.payout_min || 0), 0);
  const estMax = eligibleMatches.reduce((sum, m) => sum + (m.settlement?.payout_max || 0), 0);

  const getSettlementForBreach = (source: string) =>
    matches.find(m => m.settlement && m.settlement.company.toLowerCase().includes(source.toLowerCase()) && m.settlement.status !== "closed");

  return (
    <div>
      <PageHeader title="Breach Scan" subtitle="Scan breach databases for your exposed data" />

      {state === "idle" && (
        <div className="mx-auto max-w-lg">
          <div className="glass-card-glow p-8">
            <div className="mb-6 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="mb-1 text-center text-lg font-bold">Secure Identity Scan</h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">We'll check your information against 12,000+ breach databases</p>
            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email Address</label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Phone Number <span className="text-muted-foreground">(optional)</span></label>
                <Input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl" size="lg">
                <Search className="mr-2 h-4 w-4" /> Start Secure Scan
              </Button>
            </form>

            {/* Scan Schedule Info */}
            {(scanMeta.lastScanAt || scanMeta.nextScanAt) && (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                {scanMeta.lastScanAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Last scan: {formatDistanceToNow(new Date(scanMeta.lastScanAt), { addSuffix: true })}</span>
                  </div>
                )}
                {scanMeta.nextScanAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    <span>Next scheduled scan: {format(new Date(scanMeta.nextScanAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {state === "scanning" && (
        <div className="mx-auto max-w-lg text-center py-20">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">Scanning Databases...</h2>
          <p className="text-sm text-muted-foreground">Checking 12,847 breach databases for your identity</p>
          <div className="mt-6 mx-auto max-w-xs rounded-full bg-muted h-2 overflow-hidden">
            <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: "70%" }} />
          </div>
        </div>
      )}

      {state === "results" && (
        <div>
          {/* Scan Metadata Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {scanMeta.scanCompletedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Completed {formatDistanceToNow(new Date(scanMeta.scanCompletedAt), { addSuffix: true })}</span>
              </div>
            )}
            {scanMeta.databasesScanned > 0 && (
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                <span>{scanMeta.databasesScanned.toLocaleString()} databases scanned</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span>Type: {scanMeta.isScheduled ? "Scheduled" : "Manual"}</span>
            </div>
            {scanMeta.nextScanAt && (
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Next scan: {format(new Date(scanMeta.nextScanAt), "MMM d 'at' h:mm a")}</span>
              </div>
            )}
          </div>

          {/* Exposure Summary Banner */}
          <div className="mb-6 glass-card p-6 !border-destructive/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {breaches.length > 0 ? "You've Been Exposed in Multiple Breaches" : "No Breaches Found"}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold">{breaches.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Breaches Found</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl border bg-background/50 p-4 text-center cursor-help">
                      <p className="text-2xl font-bold text-destructive">{riskScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                      <p className="text-xs text-muted-foreground mt-1">Identity Risk Score</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px]">
                    <p className="text-xs">Your risk score reflects breach severity, data sensitivity, and recency.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">{eligibleMatches.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Settlements Matched</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-2xl font-bold gradient-emerald-text">
                  ${estMin.toLocaleString()} – ${estMax.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Estimated Compensation</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button asChild className="rounded-xl">
                <Link to="/settlements"><Eye className="mr-2 h-4 w-4" /> View Eligible Settlements</Link>
              </Button>
              <Button variant="outline" onClick={reset} className="rounded-xl">Run Another Scan</Button>
            </div>
          </div>

          {/* Premium Upsell */}
          {!isPremium && (
            <div className="mb-6 glass-card-glow p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Get daily scans + instant breach alerts</p>
                  <p className="text-xs text-muted-foreground">Upgrade to Premium for $9.99/mo</p>
                </div>
              </div>
              <Button asChild size="sm" className="rounded-xl shrink-0">
                <Link to="/pricing">Upgrade</Link>
              </Button>
            </div>
          )}

          {/* Breach Cards */}
          <div className="space-y-3">
            {breaches.map((breach) => {
              const match = getSettlementForBreach(breach.source);
              const settlement = match?.settlement;
              const catalog = breach.catalog;
              // Also check details for catalog info (from procedure)
              const detailSource = breach.details as any;
              const sourceType = catalog?.source_type || detailSource?.source_type;
              const sourceName = catalog?.source_name || detailSource?.source_name;
              const sourceUrl = catalog?.source_url || detailSource?.source_url;
              const isVerified = catalog?.verified ?? detailSource?.catalog === true;

              return (
                <div key={breach.id} className="glass-card p-6 transition-all hover:border-primary/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{breach.source}</h3>
                      {isVerified && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-[10px] px-1.5 py-0">
                                <BadgeCheck className="h-3 w-3" />
                                Verified
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">This breach has been verified by our research team</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold capitalize ${severityColor[breach.risk_level] ?? ""}`}>
                      {breach.risk_level}
                    </span>
                  </div>

                  {/* Source credibility line */}
                  {(sourceType || sourceName) && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="capitalize">{sourceType}{sourceName ? `: ${sourceName}` : ""}</span>
                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          View source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mb-2">
                    Breach Year: {breach.breach_year || "Unknown"}
                    {breach.record_count_estimate ? ` · ${breach.record_count_estimate.toLocaleString()} records` : ""}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {breach.exposed_fields.map((d) => (
                      <span key={d} className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">{d}</span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Check className={`h-3.5 w-3.5 ${settlement ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={settlement ? "text-primary font-medium" : "text-muted-foreground"}>
                          Settlement Eligible: {settlement ? "Yes" : "No"}
                        </span>
                      </div>
                      {settlement && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-primary" />
                          <span className="text-primary font-medium">
                            Est. Payout: ${settlement.payout_min?.toLocaleString()} – ${settlement.payout_max?.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    {settlement && (
                      <Link to={`/claims/file?settlement=${settlement.id}`}>
                        <Button size="sm" className="w-full rounded-xl">
                          File Claim <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                    {breach.breach_catalog_id && breach.catalog && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => setSelectedCatalogBreach(breach.catalog as BreachCatalogEntry)}
                      >
                        <Eye className="mr-1 h-3 w-3" /> View Details
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monitoring Upsell Block */}
          {!isPremium && (
            <div className="mt-8 glass-card-glow p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold">Stay Protected Going Forward</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { icon: Zap, label: "Daily breach scans" },
                  { icon: Bell, label: "Instant alerts" },
                  { icon: Crown, label: "Priority settlement matching" },
                  { icon: Activity, label: "Advanced identity monitoring" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <Button asChild size="lg" className="rounded-xl">
                <Link to="/pricing">Upgrade — $9.99/mo</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground text-center">
        BreachPay is not a law firm and does not provide legal advice. Data may be sourced from third-party providers and may be incomplete.
      </p>

      <BreachDetailModal
        breach={selectedCatalogBreach}
        open={!!selectedCatalogBreach}
        onOpenChange={(open) => !open && setSelectedCatalogBreach(null)}
      />
    </div>
  );
};

export default Scan;
