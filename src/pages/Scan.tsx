import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockBreaches, mockSettlements } from "@/data/mockData";
import { Search, Shield, AlertTriangle, Loader2, Crown, Check, Eye, DollarSign, Zap, Bell, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ScanState = "idle" | "scanning" | "results";

const severityColor: Record<string, string> = {
  low: "text-warning bg-warning/10 border-warning/20",
  medium: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  high: "text-destructive bg-destructive/10 border-destructive/20",
  critical: "text-destructive bg-destructive/10 border-destructive/20",
};

const Scan = () => {
  const [state, setState] = useState<ScanState>("idle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const isPremium = false;

  useEffect(() => {
    if (state === "scanning") {
      const timer = setTimeout(() => setState("results"), 3500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    setState("scanning");
  };

  const reset = () => { setState("idle"); setEmail(""); setPhone(""); };

  // Compute summary stats from mock data
  const eligibleSettlements = mockSettlements.filter(s => s.status === "open" || s.status === "pending");
  const estMin = eligibleSettlements.reduce((sum, s) => sum + (s.payout_min ?? 0), 0);
  const estMax = eligibleSettlements.reduce((sum, s) => sum + (s.payout_max ?? 0), 0);

  const getSettlementForBreach = (company: string) =>
    mockSettlements.find(s => s.company === company && s.status !== "closed");

  return (
    <div>
      <PageHeader title="Breach Scan" subtitle="Scan breach databases for your exposed data" />

      {state === "idle" && (
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl border bg-card p-8">
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
              <Button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300" size="lg">
                <Search className="mr-2 h-4 w-4" /> Start Secure Scan
              </Button>
            </form>
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
          {/* Exposure Summary Banner */}
          <div className="mb-6 rounded-2xl border border-destructive/20 bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-bold">You've Been Exposed in Multiple Breaches</h2>
                <span className="rounded-xl bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">Demo Mode</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold">{mockBreaches.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Breaches Found</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl border bg-background/50 p-4 text-center cursor-help">
                      <p className="text-2xl font-bold text-destructive">82<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                      <p className="text-xs text-muted-foreground mt-1">Identity Risk Score</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px]">
                    <p className="text-xs">Your risk score reflects breach severity, data sensitivity, and recency. Higher scores indicate greater exposure.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="rounded-xl border bg-background/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">{eligibleSettlements.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Settlements Matched</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-2xl font-bold text-primary drop-shadow-[0_0_8px_hsl(172_89%_52%/0.4)]">
                  ${estMin.toLocaleString()} – ${estMax.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Estimated Compensation</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button asChild className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300">
                <Link to="/settlements"><Eye className="mr-2 h-4 w-4" /> View Eligible Settlements</Link>
              </Button>
              <Button variant="outline" onClick={reset} className="rounded-xl">Run Another Scan</Button>
            </div>
          </div>

          {/* Premium Upsell — inline for Free users */}
          {!isPremium && (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-card p-5 flex items-center justify-between shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)]">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Get daily scans + instant breach alerts</p>
                  <p className="text-xs text-muted-foreground">Upgrade to Premium for $9.99/mo</p>
                </div>
              </div>
              <Button asChild size="sm" className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300 shrink-0">
                <Link to="/pricing">Upgrade</Link>
              </Button>
            </div>
          )}

          {/* Breach Cards */}
          <div className="space-y-3">
            {mockBreaches.map((breach) => {
              const settlement = getSettlementForBreach(breach.company);
              return (
                <div key={breach.id} className="rounded-2xl border bg-card p-6 transition-all hover:border-primary/20 hover:shadow-[0_0_16px_hsl(172_89%_52%/0.05)]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{breach.company}</h3>
                      <p className="text-xs text-muted-foreground">Breach Year: {breach.breach_year} · {breach.records_affected.toLocaleString()} records</p>
                    </div>
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold capitalize ${severityColor[breach.severity] ?? ""}`}>
                      {breach.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{breach.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {breach.exposed_data.map((d) => (
                      <span key={d} className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">{d}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 border-t border-border pt-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Check className={`h-3.5 w-3.5 ${settlement ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={settlement ? "text-primary font-medium" : "text-muted-foreground"}>
                        Settlement Eligible: {settlement ? "Yes" : "No"}
                      </span>
                    </div>
                    {settlement && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-primary" />
                        <span className="text-primary font-medium drop-shadow-[0_0_6px_hsl(172_89%_52%/0.3)]">
                          Est. Payout: ${settlement.payout_min?.toLocaleString()} – ${settlement.payout_max?.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monitoring Upsell Block */}
          {!isPremium && (
            <div className="mt-8 rounded-2xl border border-primary/20 bg-card p-8 shadow-[0_0_24px_0_hsl(172_89%_52%/0.06)]">
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
              <Button asChild size="lg" className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_24px_hsl(172_89%_52%/0.3)] transition-all duration-300">
                <Link to="/pricing">Upgrade — $9.99/mo</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground text-center">
        BreachPay is not a law firm and does not provide legal advice. Data may be sourced from third-party providers and may be incomplete.
      </p>
    </div>
  );
};

export default Scan;
