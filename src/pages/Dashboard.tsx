import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RiskGauge } from "@/components/RiskGauge";
import { AlertRow } from "@/components/AlertRow";
import { BreachIntelligence } from "@/components/BreachIntelligence";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { MoneyRadar } from "@/components/MoneyRadar";
import { ReferralCard } from "@/components/ReferralCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumUpgradeCard } from "@/components/PremiumUpgradeCard";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useScanSchedule } from "@/hooks/useScanSchedule";
import { ShieldAlert, Scale, DollarSign, FileText, Activity, Search, ArrowRight, Wallet, Clock, CheckCircle, CalendarClock, Shield, FileCheck } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const { data: schedule } = useScanSchedule();
  const [riskScore, setRiskScore] = useState(0);
  const [breachCount, setBreachCount] = useState(0);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [claimsCount, setClaimsCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [totalRecovered, setTotalRecovered] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [approvedValue, setApprovedValue] = useState(0);
  const [totalMin, setTotalMin] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      try {
        const { data: latestScan } = await supabase
          .from("scan_runs")
          .select("risk_score, breaches_detected")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestScan) {
          setRiskScore(latestScan.risk_score);
          setBreachCount(latestScan.breaches_detected);
        }

        const { data: matches } = await supabase
          .from("settlement_matches")
          .select("settlement_id, payout_estimate, settlements(status, payout_min, payout_max, is_demo, is_test, lifecycle_status, claim_deadline)")
          .eq("user_id", user.id);

        if (matches) {
          const today = new Date().toISOString().split("T")[0];
          const open = matches.filter((m: any) => {
            const s = m.settlements;
            if (!s) return false;
            if (s.is_demo || s.is_test) return false;
            if (s.lifecycle_status !== 'active') return false;
            if (s.claim_deadline && s.claim_deadline < today) return false;
            return s.status === "verified" || s.status === "open";
          });
          setEligibleCount(open.length);
          setTotalEstimated(open.reduce((a: number, m: any) => a + (m.settlements?.payout_max || 0), 0));
          setTotalMin(open.reduce((a: number, m: any) => a + (m.settlements?.payout_min || 0), 0));
        }

        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        setClaimsCount(count || 0);

        const [payoutsRes, claimsFullRes] = await Promise.all([
          supabase
            .from("payouts")
            .select("amount, status")
            .eq("user_id", user.id),
          supabase
            .from("claims")
            .select("status, net_payout, est_payout")
            .eq("user_id", user.id),
        ]);

        if (payoutsRes.data) {
          setTotalRecovered(
            payoutsRes.data
              .filter((p: any) => p.status === "paid")
              .reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0)
          );
        }
        if (claimsFullRes.data) {
          setPendingPayouts(
            claimsFullRes.data
              .filter((c: any) => c.status === "approved")
              .reduce((a: number, c: any) => a + (Number(c.net_payout) || Number(c.est_payout) || 0), 0)
          );
          setApprovedValue(
            claimsFullRes.data
              .filter((c: any) => c.status === "approved" || c.status === "paid")
              .reduce((a: number, c: any) => a + (Number(c.net_payout) || Number(c.est_payout) || 0), 0)
          );
        }

        const { data: alertsData } = await supabase
          .from("alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (alertsData) {
          setAlerts(alertsData.map(a => ({
            id: a.id,
            title: a.title,
            description: a.body || "",
            category: a.type,
            severity: a.severity,
            created_at: a.created_at,
            read: a.is_read,
          })));
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [user]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your compensation overview" />

      {/* Hero Recovery Card */}
      {!loading && totalEstimated > 0 ? (
        <div className="mb-6 glass-card-glow p-8 text-center relative overflow-hidden">
          {/* Soft background glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <div className="h-48 w-48 rounded-full bg-primary/8 blur-3xl" />
          </div>
          <div className="relative">
            <p className="text-sm text-muted-foreground mb-2">Potential Recovery</p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-bold gradient-emerald-text tracking-tight">
                <AnimatedNumber value={totalEstimated} prefix="$" />
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Estimated compensation across your detected settlement opportunities.
            </p>

            {/* Recovery summary box */}
            {eligibleCount > 0 && (
              <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-foreground font-medium">{eligibleCount} verified settlement{eligibleCount !== 1 ? "s" : ""} detected</span>
                </div>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  ${totalMin.toLocaleString()}–${totalEstimated.toLocaleString()}
                </span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-3">
              <Button className="rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-300" asChild>
                <Link to="/settlements">View Matches <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              {eligibleCount > 1 && (
                <Button variant="outline" className="rounded-xl" asChild>
                  <Link to="/claims"><FileCheck className="mr-2 h-4 w-4" /> File All Eligible Claims</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : !loading && eligibleCount === 0 ? (
        <div className="mb-6 glass-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No recovery opportunities detected yet.</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            Run a breach scan to check if you may qualify for compensation from data breach settlements.
          </p>
          <Button className="rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-300" asChild>
            <Link to="/scan"><Search className="mr-2 h-4 w-4" />Run Secure Scan</Link>
          </Button>
        </div>
      ) : null}

      {/* Deadline Countdown */}
      <div className="mb-6">
        <DeadlineCountdown />
      </div>

      {/* Money Radar */}
      <div className="mb-6">
        <MoneyRadar />
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Risk Gauge */}
        <div className="flex items-center justify-center glass-card-glow p-6 lg:row-span-2">
          <RiskGauge score={riskScore} />
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={ShieldAlert} label="Exposure Findings" value={loading ? "—" : breachCount} variant="teal" />
          <StatCard icon={Scale} label="Opportunities" value={loading ? "—" : eligibleCount} />
          <StatCard icon={DollarSign} label="Estimated Compensation" value={loading ? "—" : `$${totalEstimated.toLocaleString()}`} variant="teal" />
          <StatCard icon={FileText} label="Money Claims" value={loading ? "—" : claimsCount} />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-xl">
            <Link to="/scan"><Search className="mr-2 h-4 w-4" />Run Scan</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/settlements">View Settlements <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/claims">Track Claims <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
      </div>

      {/* Compensation Wallet */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Compensation Wallet</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="rounded-xl text-xs">
            <Link to="/claims">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Wallet} label="Total Recovered" value={loading ? "—" : `$${totalRecovered.toLocaleString()}`} variant="teal" />
          <StatCard icon={Clock} label="Pending Payouts" value={loading ? "—" : `$${pendingPayouts.toLocaleString()}`} />
          <StatCard icon={CheckCircle} label="Approved Value" value={loading ? "—" : `$${approvedValue.toLocaleString()}`} variant="teal" />
        </div>
      </div>
      </div>

      {/* Scheduled Scan Status */}
      {schedule && (
        <div className="mt-8 glass-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">Scheduled Scans</h3>
                <p className="text-xs text-muted-foreground">
                  {schedule.is_enabled
                    ? `${schedule.frequency} · Next: ${new Date(schedule.next_run_at).toLocaleString()}`
                    : "Disabled"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={schedule.is_enabled ? "border-primary/30 text-primary" : "border-muted text-muted-foreground"}>
              {schedule.is_enabled ? "Active" : "Off"}
            </Badge>
          </div>
        </div>
      )}

      {/* Premium Upgrade */}
      <div className="mt-8">
        <PremiumUpgradeCard placement="dashboard" compact />
      </div>

      {/* Breach Intelligence */}
      <div className="mt-8">
        <BreachIntelligence />
      </div>

      {/* Referral Card */}
      <div className="mt-8">
        <ReferralCard />
      </div>

      {/* Recent Alerts */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Recent Alerts</h2>
        </div>
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No alerts yet. Run a scan to get started.</p>
          ) : (
            alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground text-center">
        BreachPay is not a law firm and does not provide legal advice. Data may be sourced from third-party providers and may be incomplete.
      </p>
    </div>
  );
};

export default Dashboard;
