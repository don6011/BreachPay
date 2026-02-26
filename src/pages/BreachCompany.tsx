import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PayoutRange } from "@/components/PayoutRange";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import logo from "@/assets/logo.png";
import { ArrowRight, Shield, AlertTriangle, Database } from "lucide-react";

interface BreachEntry {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  severity: string;
  records_exposed: number | null;
  data_types: string[] | null;
  settlement_available: boolean | null;
  settlement_name: string | null;
  estimated_payout_min: number | null;
  estimated_payout_max: number | null;
  claim_deadline: string | null;
}

interface SettlementEntry {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  payout_min: number | null;
  payout_max: number | null;
  claim_deadline: string | null;
  deadline: string | null;
  canonical_key: string;
  status: string;
}

function formatCompanyName(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const BreachCompany = () => {
  const { company } = useParams<{ company: string }>();
  const [breaches, setBreaches] = useState<BreachEntry[]>([]);
  const [settlements, setSettlements] = useState<SettlementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const companyName = company ? formatCompanyName(company) : "";

  useEffect(() => {
    if (!company) return;

    const fetchData = async () => {
      const searchTerm = companyName;

      const [breachRes, settlementRes] = await Promise.all([
        supabase
          .from("breach_catalog")
          .select("id, name, company, breach_year, severity, records_exposed, data_types, settlement_available, settlement_name, estimated_payout_min, estimated_payout_max, claim_deadline")
          .eq("active", true)
          .ilike("company", `%${searchTerm}%`)
          .order("breach_year", { ascending: false }),
        supabase
          .from("settlements")
          .select("id, name, company, breach_year, payout_min, payout_max, claim_deadline, deadline, canonical_key, status")
          .eq("verified", true)
          .ilike("company", `%${searchTerm}%`)
          .order("breach_year", { ascending: false }),
      ]);

      setBreaches((breachRes.data || []) as BreachEntry[]);
      setSettlements((settlementRes.data || []) as SettlementEntry[]);
      setLoading(false);
    };

    fetchData();
  }, [company, companyName]);

  useEffect(() => {
    document.title = `${companyName} Data Breaches & Settlements | BreachPay`;
  }, [companyName]);

  const severityColor = (s: string) => {
    if (s === "critical") return "text-critical bg-critical/10";
    if (s === "high") return "text-warning bg-warning/10";
    if (s === "medium") return "text-primary bg-primary/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-background/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/"><img src={logo} alt="BreachPay" className="h-10" /></Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Log In</Link></Button>
            <Button asChild className="rounded-xl"><Link to="/scan">Run My Free Scan</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          {companyName} Data Breaches & Settlements
        </h1>
        <p className="text-muted-foreground mb-8">
          All known data breaches involving {companyName} and any active settlements you may be eligible for.
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Active Settlements */}
            {settlements.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> Active Settlements
                </h2>
                <div className="space-y-3">
                  {settlements.map((s) => (
                    <Link
                      key={s.id}
                      to={`/settlement/${s.canonical_key}`}
                      className="glass-card p-5 flex items-center justify-between hover:border-primary/20 transition-colors block"
                    >
                      <div>
                        <h3 className="font-semibold mb-1">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">{s.company} · {s.breach_year}</p>
                        <PayoutRange min={s.payout_min || 0} max={s.payout_max || 0} size="sm" className="mt-2" />
                      </div>
                      <div className="flex items-center gap-3">
                        <DeadlineBadge deadline={s.claim_deadline || s.deadline} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Breach History */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Breach History
              </h2>
              {breaches.length === 0 && settlements.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-muted-foreground mb-4">No breach records found for {companyName}.</p>
                  <Button asChild className="rounded-xl">
                    <Link to="/scan">Scan Your Email Instead <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {breaches.map((b) => (
                    <div key={b.id} className="glass-card p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-sm">{b.name}</h3>
                          <p className="text-xs text-muted-foreground">{b.breach_year}</p>
                        </div>
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${severityColor(b.severity)}`}>
                          {b.severity.toUpperCase()}
                        </span>
                      </div>
                      {b.records_exposed && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {b.records_exposed.toLocaleString()} records exposed
                        </p>
                      )}
                      {b.data_types && b.data_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {b.data_types.map((dt) => (
                            <span key={dt} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{dt}</span>
                          ))}
                        </div>
                      )}
                      {b.settlement_available && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-primary font-medium">Settlement available</span>
                          {b.estimated_payout_min !== null && b.estimated_payout_max !== null && (
                            <PayoutRange min={b.estimated_payout_min} max={b.estimated_payout_max} size="sm" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* CTA */}
            <section className="glass-card-glow p-8 text-center">
              <h2 className="text-2xl font-bold mb-2">See If You're Owed Money</h2>
              <p className="text-muted-foreground mb-6">
                Check if any {companyName} breach affected your personal data — free and instant.
              </p>
              <Button asChild size="lg" className="rounded-xl shadow-[0_0_20px_hsl(164_100%_45%/0.25)]">
                <Link to="/scan">Run My Free Scan <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-border py-8 bg-background mt-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 BreachPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default BreachCompany;
