import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Shield, Scale, FileText, DollarSign, BarChart3, TrendingUp, AlertTriangle, Plus, Send, Download, Flag, Target, Activity, Clock } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const COLORS = ["hsl(172, 89%, 52%)", "hsl(172, 84%, 39%)"];

// ... keep existing code (interfaces)
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

interface FunnelData {
  match_viewed: number;
  claim_started: number;
  claim_submitted: number;
  start_rate_pct: number;
  submit_rate_pct: number;
}

interface AuditEntry {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

const AdminAnalytics = () => {
  const { user } = useAuth();
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [settlementMetrics, setSettlementMetrics] = useState<SettlementMetrics[]>([]);
  const [claimsCount, setClaimsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const [revenueCollected, setRevenueCollected] = useState(0);
  const [pendingFees, setPendingFees] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [paidClaimsCount, setPaidClaimsCount] = useState(0);
  const [approvedClaimsCount, setApprovedClaimsCount] = useState(0);
  const [rejectedClaimsCount, setRejectedClaimsCount] = useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);

  // Funnel analytics
  const [funnel, setFunnel] = useState<FunnelData>({ match_viewed: 0, claim_started: 0, claim_submitted: 0, start_rate_pct: 0, submit_rate_pct: 0 });
  const [dailyScanners, setDailyScanners] = useState<{ day: string; scanner_count: number }[]>([]);
  const [avgTimeToSubmit, setAvgTimeToSubmit] = useState<number | null>(null);
  const [avgTimeToPaid, setAvgTimeToPaid] = useState<number | null>(null);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);

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

        const collected = paid.reduce((a: number, c: any) => a + (Number(c.platform_fee) || 0), 0);
        setRevenueCollected(collected);
        const pendFees = approved.reduce((a: number, c: any) => a + (Number(c.platform_fee) || Number(c.est_payout) * 0.15 || 0), 0);
        setPendingFees(pendFees);
        const totalPaid = paid.reduce((a: number, c: any) => a + (Number(c.final_payout) || 0), 0);
        setTotalPayouts(totalPaid);
      }

      // Funnel data from product_events
      const [funnelRes, scannersRes, ttsRes, ttpRes, auditRes] = await Promise.all([
        supabase.from("product_events")
          .select("event_name")
          .in("event_name", ["match_viewed", "claim_started", "claim_submitted"]),
        supabase.from("product_events")
          .select("user_id, created_at")
          .eq("event_name", "scan_started")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("product_events")
          .select("meta, created_at")
          .eq("event_name", "claim_started")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("product_events")
          .select("meta, created_at")
          .eq("event_name", "payout_marked_paid")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("admin_activity_logs")
          .select("id, admin_user_id, action, entity_type, entity_id, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (funnelRes.data) {
        const events = funnelRes.data as any[];
        const mv = events.filter(e => e.event_name === "match_viewed").length;
        const cs = events.filter(e => e.event_name === "claim_started").length;
        const csub = events.filter(e => e.event_name === "claim_submitted").length;
        setFunnel({
          match_viewed: mv,
          claim_started: cs,
          claim_submitted: csub,
          start_rate_pct: mv > 0 ? Math.round(cs / mv * 1000) / 10 : 0,
          submit_rate_pct: cs > 0 ? Math.round(csub / cs * 1000) / 10 : 0,
        });
      }

      if (scannersRes.data) {
        const byDay: Record<string, Set<string>> = {};
        scannersRes.data.forEach((e: any) => {
          const day = e.created_at.slice(0, 10);
          if (!byDay[day]) byDay[day] = new Set();
          byDay[day].add(e.user_id);
        });
        const arr = Object.entries(byDay).map(([day, users]) => ({ day, scanner_count: users.size })).sort((a, b) => a.day.localeCompare(b.day)).slice(-14);
        setDailyScanners(arr);
      }

      // Compute avg time-to-submit from claim_started events
      if (ttsRes.data && ttsRes.data.length > 0) {
        const claimIds = ttsRes.data.map((e: any) => (e.meta as any)?.claim_id).filter(Boolean);
        if (claimIds.length > 0) {
          const { data: submitEvents } = await supabase.from("product_events")
            .select("meta, created_at")
            .eq("event_name", "claim_submitted")
            .limit(200);
          if (submitEvents) {
            const submitMap: Record<string, string> = {};
            submitEvents.forEach((e: any) => { if ((e.meta as any)?.claim_id) submitMap[(e.meta as any).claim_id] = e.created_at; });
            let totalHours = 0, count = 0;
            ttsRes.data.forEach((e: any) => {
              const cid = (e.meta as any)?.claim_id;
              if (cid && submitMap[cid]) {
                totalHours += (new Date(submitMap[cid]).getTime() - new Date(e.created_at).getTime()) / 3600000;
                count++;
              }
            });
            if (count > 0) setAvgTimeToSubmit(Math.round(totalHours / count * 10) / 10);
          }
        }
      }

      // Compute avg time-to-paid
      if (ttpRes.data && ttpRes.data.length > 0) {
        const claimIds = ttpRes.data.map((e: any) => (e.meta as any)?.claim_id).filter(Boolean);
        if (claimIds.length > 0) {
          const { data: submitEvents } = await supabase.from("product_events")
            .select("meta, created_at")
            .eq("event_name", "claim_submitted")
            .limit(200);
          if (submitEvents) {
            const submitMap: Record<string, string> = {};
            submitEvents.forEach((e: any) => { if ((e.meta as any)?.claim_id) submitMap[(e.meta as any).claim_id] = e.created_at; });
            let totalDays = 0, count = 0;
            ttpRes.data.forEach((e: any) => {
              const cid = (e.meta as any)?.claim_id;
              if (cid && submitMap[cid]) {
                totalDays += (new Date(e.created_at).getTime() - new Date(submitMap[cid]).getTime()) / 86400000;
                count++;
              }
            });
            if (count > 0) setAvgTimeToPaid(Math.round(totalDays * 10) / 10);
          }
        }
      }

      if (auditRes.data) setRecentAudit(auditRes.data as AuditEntry[]);
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

  const funnelChartData = [
    { name: "Matches Viewed", value: funnel.match_viewed },
    { name: "Claims Started", value: funnel.claim_started },
    { name: "Claims Submitted", value: funnel.claim_submitted },
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

      {/* Funnel Analytics */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Conversion Funnel</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-4">
          <StatCard icon={BarChart3} label="Matches Viewed" value={funnel.match_viewed} />
          <StatCard icon={FileText} label="Claims Started" value={funnel.claim_started} />
          <StatCard icon={Shield} label="Claims Submitted" value={funnel.claim_submitted} />
          <StatCard icon={TrendingUp} label="Start Rate" value={`${funnel.start_rate_pct}%`} variant="teal" />
          <StatCard icon={TrendingUp} label="Submit Rate" value={`${funnel.submit_rate_pct}%`} variant="teal" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-3">Funnel Breakdown</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={funnelChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(219, 31%, 16%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215, 16%, 60%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 16%, 60%)" }} />
                <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
                <Bar dataKey="value" fill="hsl(172, 89%, 52%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-3">Timing Metrics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">Avg Time to Submit</span>
                </div>
                <span className="font-bold text-primary">{avgTimeToSubmit !== null ? `${avgTimeToSubmit}h` : "—"}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">Avg Time to Paid</span>
                </div>
                <span className="font-bold text-primary">{avgTimeToPaid !== null ? `${avgTimeToPaid}d` : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Active Scanners */}
      {dailyScanners.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Daily Active Scanners (14d)</h2>
          <div className="glass-card p-6">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dailyScanners}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(219, 31%, 16%)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(215, 16%, 60%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 16%, 60%)" }} />
                <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="scanner_count" stroke="hsl(172, 89%, 52%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

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

      {/* Revenue Operations */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Revenue Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={DollarSign} label="Revenue Collected" value={`$${revenueCollected.toLocaleString()}`} variant="teal" />
          <StatCard icon={DollarSign} label="Pending Fees" value={`$${pendingFees.toLocaleString()}`} />
          <StatCard icon={TrendingUp} label="Projected Monthly" value={`$${projectedMonthly.toLocaleString()}`} variant="teal" />
          <StatCard icon={BarChart3} label="Platform Fee" value="15%" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
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

      {/* Admin Audit Trail */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Compliance Audit Trail</h2>
        </div>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-3 text-center text-muted-foreground">No audit entries yet</td></tr>
              ) : recentAudit.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium capitalize">{a.action.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-xs">{a.entity_type} {a.entity_id ? `(${a.entity_id.slice(0, 8)})` : ""}</td>
                  <td className="px-4 py-3 font-mono text-xs">{a.admin_user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
