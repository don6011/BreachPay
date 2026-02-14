import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Shield, Scale, FileText, DollarSign, BarChart3, TrendingUp, AlertTriangle, Plus, Send, Download, Flag, Target } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const COLORS = ["hsl(172, 89%, 52%)", "hsl(172, 84%, 39%)"];

interface FraudFlag {
  id: string;
  claim_id: string;
  user_id: string;
  reason: string;
  severity: string;
  resolved: boolean;
}

interface SettlementMetrics {
  id: string;
  settlement_id: string;
  total_matches: number;
  total_claims_filed: number;
  total_approved: number;
  total_paid: number;
  total_payout_amount: number;
  avg_payout: number | null;
  conversion_rate: number | null;
}

const AdminAnalytics = () => {
  const { user } = useAuth();
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [settlementMetrics, setSettlementMetrics] = useState<SettlementMetrics[]>([]);
  const [claimsCount, setClaimsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  // Revenue data from claims
  const [revenueCollected, setRevenueCollected] = useState(0);
  const [pendingFees, setPendingFees] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [paidClaimsCount, setPaidClaimsCount] = useState(0);
  const [approvedClaimsCount, setApprovedClaimsCount] = useState(0);
  const [rejectedClaimsCount, setRejectedClaimsCount] = useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchAdminData();
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const [fraudRes, metricsRes, claimsRes, usersRes, revenueRes] = await Promise.all([
        supabase.from("fraud_flags").select("*").eq("resolved", false),
        supabase.from("settlement_performance_metrics").select("*").order("total_payout_amount", { ascending: false }),
        supabase.from("claims").select("*", { count: "exact", head: true }),
        supabase.from("user_profiles").select("*", { count: "exact", head: true }),
        supabase.from("claims").select("status, final_payout, platform_fee, net_payout, est_payout"),
      ]);

      if (fraudRes.data) setFraudFlags(fraudRes.data);
      if (metricsRes.data) setSettlementMetrics(metricsRes.data);
      setClaimsCount(claimsRes.count || 0);
      setUsersCount(usersRes.count || 0);

      if (revenueRes.data) {
        const allClaims = revenueRes.data;
        const paid = allClaims.filter((c: any) => c.status === "paid");
        const approved = allClaims.filter((c: any) => c.status === "approved");
        const rejected = allClaims.filter((c: any) => c.status === "rejected");
        const pending = allClaims.filter((c: any) => c.status === "under_review" || c.status === "submitted");

        setPaidClaimsCount(paid.length);
        setApprovedClaimsCount(approved.length);
        setRejectedClaimsCount(rejected.length);
        setPendingClaimsCount(pending.length);

        // Revenue = sum of platform_fee for paid claims
        const collected = paid.reduce((a: number, c: any) => a + (Number(c.platform_fee) || 0), 0);
        setRevenueCollected(collected);

        // Pending fees = platform_fee for approved (not yet paid)
        const pendFees = approved.reduce((a: number, c: any) => a + (Number(c.platform_fee) || Number(c.est_payout) * 0.15 || 0), 0);
        setPendingFees(pendFees);

        // Total payouts
        const totalPaid = paid.reduce((a: number, c: any) => a + (Number(c.final_payout) || 0), 0);
        setTotalPayouts(totalPaid);
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAlerts = async () => {
    setSendingAlerts(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/run-deadline-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) toast({ title: "Success", description: `Sent ${data.alerts_sent} deadline alerts` });
      else if (data.message) toast({ title: "Info", description: data.message });
      else throw new Error(data.error || "Unknown error");
    } catch (error) {
      toast({ title: "Error", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
    } finally {
      setSendingAlerts(false);
    }
  };

  const projectedMonthly = revenueCollected > 0 ? Math.round(revenueCollected * 4) : Math.round(pendingFees * 2);

  const revenueBreakdown = [
    { name: "Filing Fees (15%)", value: revenueCollected + pendingFees || 1 },
    { name: "Paid Out to Users", value: totalPayouts || 1 },
  ];

  return (
    <div>
      <PageHeader title="Platform Intelligence" subtitle="Admin analytics dashboard">
        <Button size="sm" asChild className="rounded-xl"><Link to="/admin/settlements"><Plus className="mr-1 h-3 w-3" />Add Settlement</Link></Button>
        <Button size="sm" variant="outline" asChild className="rounded-xl"><Link to="/admin/claims">Review Claims</Link></Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handleSendAlerts} disabled={sendingAlerts}><Send className="mr-1 h-3 w-3" />{sendingAlerts ? "Sending..." : "Send Alerts"}</Button>
        <Button size="sm" variant="outline" className="rounded-xl"><Download className="mr-1 h-3 w-3" />Export</Button>
      </PageHeader>

      {/* Top Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={Users} label="Registered Users" value={usersCount} variant="teal" />
        <StatCard icon={Shield} label="Total Claims" value={claimsCount} />
        <StatCard icon={AlertTriangle} label="Fraud Flags" value={fraudFlags.length} />
        <StatCard icon={Scale} label="Settlements" value={settlementMetrics.length} variant="teal" />
      </div>

      {/* Claims Pipeline */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Claims Pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Filed", value: claimsCount, color: "bg-primary" },
            { label: "Pending Review", value: pendingClaimsCount, color: "bg-warning" },
            { label: "Approved", value: approvedClaimsCount, color: "bg-success" },
            { label: "Rejected", value: rejectedClaimsCount, color: "bg-destructive" },
            { label: "Paid Out", value: paidClaimsCount, color: "bg-success" },
            { label: "Flagged", value: fraudFlags.length, color: "bg-warning" },
          ].map((item) => (
            <div key={item.label} className="glass-card p-4 text-center">
              <div className={`mx-auto mb-2 h-2.5 w-2.5 rounded-full ${item.color}`} />
              <div className="text-xl font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Revenue Operations — LIVE DATA */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Revenue Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={DollarSign} label="Revenue Collected" value={`$${revenueCollected.toLocaleString()}`} variant="teal" />
          <StatCard icon={DollarSign} label="Pending Fees" value={`$${pendingFees.toLocaleString()}`} />
          <StatCard icon={TrendingUp} label="Projected Monthly" value={`$${projectedMonthly.toLocaleString()}`} variant="teal" />
          <StatCard icon={BarChart3} label="Platform Fee" value="15%" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue summary table */}
          <div className="lg:col-span-2 glass-card p-6">
            <h3 className="mb-4 text-sm font-semibold">Revenue Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Gross Payouts</span>
                <span className="text-sm font-bold">${totalPayouts.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Platform Fees Collected (15%)</span>
                <span className="text-sm font-bold text-primary">${revenueCollected.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Pending Fees (Approved, not paid)</span>
                <span className="text-sm font-bold text-warning">${pendingFees.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Net Paid to Users</span>
                <span className="text-sm font-bold text-success">${Math.max(0, totalPayouts - revenueCollected).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold">Monthly Projection</span>
                <span className="text-sm font-bold text-primary">${projectedMonthly.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Breakdown pie */}
          <div className="glass-card p-6">
            <h3 className="mb-4 text-sm font-semibold">Revenue vs Payouts</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={revenueBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} strokeWidth={0}>
                  {revenueBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {revenueBreakdown.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">${item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Fraud Detection */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Flag className="h-4 w-4 text-destructive" />
          <h2 className="text-lg font-semibold">Fraud Detection Flags</h2>
        </div>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claim</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Severity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
              </tr>
            </thead>
            <tbody>
              {fraudFlags.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-3 text-center text-muted-foreground">No fraud flags detected</td></tr>
              ) : (
                fraudFlags.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">Fraud Alert</td>
                    <td className="px-4 py-3 font-mono text-xs">{f.claim_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        f.severity === "high" || f.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                      }`}>{f.severity}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{f.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Settlement Performance */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Settlement Performance</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {settlementMetrics.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground p-6">No settlement data yet</div>
          ) : (
            settlementMetrics.slice(0, 4).map((s) => (
              <div key={s.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Settlement {s.settlement_id.slice(0, 8)}</h3>
                  <span className="text-xs text-muted-foreground">{s.total_claims_filed} claims</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Conversion Rate</span>
                      <span className="text-primary font-medium">{(s.conversion_rate || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={s.conversion_rate || 0} className="h-1.5" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Avg Payout</span>
                    <span className="text-primary font-medium">${(s.avg_payout || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminAnalytics;
