import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RiskGauge } from "@/components/RiskGauge";
import { AlertRow } from "@/components/AlertRow";
import { BreachIntelligence } from "@/components/BreachIntelligence";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { ReferralCard } from "@/components/ReferralCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumUpgradeCard } from "@/components/PremiumUpgradeCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useScanSchedule } from "@/hooks/useScanSchedule";
import { ShieldAlert, Scale, DollarSign, FileText, Activity, Search, ArrowRight, Wallet, Clock, CheckCircle, CalendarClock } from "lucide-react";
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

  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      try {
        // Latest scan run for risk score + breach count
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

        // Settlement matches with settlement details - only active verified settlements
        const { data: matches } = await supabase
          .from("settlement_matches")
          .select("settlement_id, payout_estimate, settlements(status, payout_max, is_demo, is_test, lifecycle_status, claim_deadline)")
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
        }

        // Claims count
        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        setClaimsCount(count || 0);

        // Payout wallet data
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

        // Recent alerts
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

      {/* Estimated Value Hero */}
      {!loading && totalEstimated > 0 && (
        <div className="mb-6 glass-card-glow p-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">You may be eligible for up to</p>
          <p className="text-3xl font-bold gradient-emerald-text">${totalEstimated.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">in estimated compensation across {eligibleCount} opportunit{eligibleCount !== 1 ? "ies" : "y"}</p>
          <Button className="mt-4 rounded-xl" asChild>
            <Link to="/settlements">View Matches <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      )}

      {/* Deadline Countdown */}
      <div className="mb-6">
        <DeadlineCountdown />
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
