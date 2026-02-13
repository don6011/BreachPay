import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { mockAdminUsers, mockSettlements, mockClaims } from "@/data/mockData";
import { Users, Shield, Scale, FileText, DollarSign, BarChart3, TrendingUp, AlertTriangle, Plus, Send, Download, Flag, Target } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";

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

const settlementPerformance = [
  { name: "Equifax", claimsRate: 78, avgPayout: 425, totalClaims: 156 },
  { name: "Facebook", claimsRate: 62, avgPayout: 150, totalClaims: 89 },
  { name: "T-Mobile", claimsRate: 45, avgPayout: 280, totalClaims: 34 },
  { name: "Capital One", claimsRate: 71, avgPayout: 300, totalClaims: 112 },
];

const fraudFlags = [
  { id: "f1", type: "Duplicate Filing", claimId: "c-2847", user: "suspect@temp.com", risk: "high", details: "Same SSN used across 3 accounts" },
  { id: "f2", type: "Velocity Anomaly", claimId: "c-3012", user: "bulk@domain.com", risk: "medium", details: "12 claims filed in 2 minutes" },
  { id: "f3", type: "Identity Mismatch", claimId: "c-3145", user: "mismatch@email.com", risk: "high", details: "Name doesn't match breach records" },
];

const AdminAnalytics = () => {
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
        <StatCard icon={Users} label="Registered Users" value={mockAdminUsers.length} variant="teal" />
        <StatCard icon={Shield} label="Active Monitoring" value={mockAdminUsers.filter(u => u.status === "active").length} />
        <StatCard icon={AlertTriangle} label="Breaches Detected" value={mockAdminUsers.reduce((a, u) => a + u.breaches, 0)} />
        <StatCard icon={Scale} label="Settlements Added" value={mockSettlements.length} variant="teal" />
      </div>

      {/* Claims Pipeline */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Claims Pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Filed", value: mockClaims.length, color: "bg-primary" },
            { label: "Pending", value: mockClaims.filter(c => c.status === "under_review").length, color: "bg-warning" },
            { label: "Approved", value: mockClaims.filter(c => c.status === "approved").length, color: "bg-success" },
            { label: "Rejected", value: 0, color: "bg-critical" },
            { label: "Paid Out", value: mockClaims.filter(c => c.status === "paid").length, color: "bg-success" },
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risk</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {fraudFlags.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{f.type}</td>
                  <td className="px-4 py-3 font-mono text-xs">{f.claimId}</td>
                  <td className="px-4 py-3 text-xs">{f.user}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      f.risk === "high" ? "bg-critical/10 text-critical" : "bg-warning/10 text-warning"
                    }`}>{f.risk}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.details}</td>
                </tr>
              ))}
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
          {settlementPerformance.map((s) => (
            <div key={s.name} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{s.name}</h3>
                <span className="text-xs text-muted-foreground">{s.totalClaims} claims</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Conversion Rate</span>
                    <span className="text-primary font-medium">{s.claimsRate}%</span>
                  </div>
                  <Progress value={s.claimsRate} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Avg Payout</span>
                  <span className="text-primary font-medium">${s.avgPayout}</span>
                </div>
              </div>
            </div>
          ))}
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
