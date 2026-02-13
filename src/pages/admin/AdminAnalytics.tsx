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

const claimsOverTime = [
  { month: "Sep", claims: 12 }, { month: "Oct", claims: 28 }, { month: "Nov", claims: 45 },
  { month: "Dec", claims: 38 }, { month: "Jan", claims: 62 }, { month: "Feb", claims: 71 },
];
const payoutsOverTime = [
  { month: "Sep", amount: 2400 }, { month: "Oct", amount: 5800 }, { month: "Nov", amount: 9200 },
  { month: "Dec", amount: 7500 }, { month: "Jan", amount: 14200 }, { month: "Feb", amount: 18500 },
];

const revenueBreakdown = [
  { name: "Filing Fees", value: 2800 },
  { name: "Subscriptions", value: 1450 },
];
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

  useEffect(() => {
    if (!user) return;

    const fetchAdminData = async () => {
      try {
        // Fetch fraud flags
        const { data: fraudData } = await supabase
          .from("fraud_flags")
          .select("*")
          .eq("resolved", false);
        if (fraudData) setFraudFlags(fraudData);

        // Fetch settlement metrics
        const { data: metricsData } = await supabase
          .from("settlement_performance_metrics")
          .select("*")
          .order("total_payout_amount", { ascending: false });
        if (metricsData) setSettlementMetrics(metricsData);

        // Fetch claims count
        const { count: claimsTotal } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true });
        setClaimsCount(claimsTotal || 0);

        // Fetch users count
        const { count: usersTotal } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true });
        setUsersCount(usersTotal || 0);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [user]);
  return (
    <div>
      <PageHeader title="Platform Intelligence" subtitle="Admin analytics dashboard">
        <Button size="sm" asChild className="rounded-xl"><Link to="/admin/settlements"><Plus className="mr-1 h-3 w-3" />Add Settlement</Link></Button>
        <Button size="sm" variant="outline" asChild className="rounded-xl"><Link to="/admin/claims">Review Claims</Link></Button>
        <Button size="sm" variant="outline" className="rounded-xl"><Send className="mr-1 h-3 w-3" />Send Alerts</Button>
        <Button size="sm" variant="outline" className="rounded-xl"><Download className="mr-1 h-3 w-3" />Export</Button>
      </PageHeader>

      {/* Top Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={Users} label="Registered Users" value={usersCount} variant="teal" />
        <StatCard icon={Shield} label="Active Monitoring" value={Math.floor(usersCount * 0.7)} />
        <StatCard icon={AlertTriangle} label="Breaches Detected" value={Math.floor(claimsCount * 0.3)} />
        <StatCard icon={Scale} label="Settlements Added" value={settlementMetrics.length} variant="teal" />
      </div>

      {/* Claims Pipeline */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Claims Pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Filed", value: claimsCount, color: "bg-primary" },
            { label: "Pending", value: Math.floor(claimsCount * 0.2), color: "bg-warning" },
            { label: "Approved", value: Math.floor(claimsCount * 0.3), color: "bg-success" },
            { label: "Rejected", value: Math.floor(claimsCount * 0.05), color: "bg-critical" },
            { label: "Paid Out", value: Math.floor(claimsCount * 0.4), color: "bg-success" },
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

      {/* Revenue Ops */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Revenue Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={DollarSign} label="Revenue Collected" value="$4,250" variant="teal" />
          <StatCard icon={DollarSign} label="Pending" value="$2,800" />
          <StatCard icon={TrendingUp} label="Projected Monthly" value="$8,500" variant="teal" />
          <StatCard icon={BarChart3} label="Platform Fee" value="15%" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 glass-card p-6">
            <h3 className="mb-4 text-sm font-semibold">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={payoutsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(219, 31%, 16%)" />
                <XAxis dataKey="month" tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="amount" stroke="hsl(172, 89%, 52%)" strokeWidth={2} dot={{ fill: "hsl(172, 89%, 52%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-6">
            <h3 className="mb-4 text-sm font-semibold">Revenue Breakdown</h3>
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
           <Flag className="h-4 w-4 text-critical" />
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
                 <tr>
                   <td colSpan={4} className="px-4 py-3 text-center text-muted-foreground">No fraud flags detected</td>
                 </tr>
               ) : (
                 fraudFlags.map((f) => (
                   <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                     <td className="px-4 py-3 font-medium">Fraud Alert</td>
                     <td className="px-4 py-3 font-mono text-xs">{f.claim_id.slice(0, 8)}</td>
                     <td className="px-4 py-3">
                       <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                         f.severity === "high" || f.severity === "critical" ? "bg-critical/10 text-critical" : "bg-warning/10 text-warning"
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

      {/* Claims Over Time Chart */}
      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold">Claims Filed Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={claimsOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(219, 31%, 16%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
            <Bar dataKey="claims" fill="hsl(172, 89%, 52%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminAnalytics;
