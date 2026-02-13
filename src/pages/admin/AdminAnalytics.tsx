import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { mockAdminUsers, mockSettlements, mockClaims } from "@/data/mockData";
import { Users, Shield, Scale, FileText, DollarSign, BarChart3, TrendingUp, AlertTriangle, Plus, Send, Download } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";

const claimsOverTime = [
  { month: "Sep", claims: 12 }, { month: "Oct", claims: 28 }, { month: "Nov", claims: 45 },
  { month: "Dec", claims: 38 }, { month: "Jan", claims: 62 }, { month: "Feb", claims: 71 },
];
const payoutsOverTime = [
  { month: "Sep", amount: 2400 }, { month: "Oct", amount: 5800 }, { month: "Nov", amount: 9200 },
  { month: "Dec", amount: 7500 }, { month: "Jan", amount: 14200 }, { month: "Feb", amount: 18500 },
];

const AdminAnalytics = () => {
  return (
    <div>
      <PageHeader title="Platform Intelligence" subtitle="Admin analytics dashboard">
        <Button size="sm" asChild><Link to="/admin/settlements"><Plus className="mr-1 h-3 w-3" />Add Settlement</Link></Button>
        <Button size="sm" variant="outline" asChild><Link to="/admin/claims">Review Claims</Link></Button>
        <Button size="sm" variant="outline"><Send className="mr-1 h-3 w-3" />Send Alerts</Button>
        <Button size="sm" variant="outline"><Download className="mr-1 h-3 w-3" />Export</Button>
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
            { label: "Flagged", value: 0, color: "bg-warning" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-4 text-center">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={DollarSign} label="Revenue Collected" value="$4,250" variant="teal" />
          <StatCard icon={DollarSign} label="Pending" value="$2,800" />
          <StatCard icon={TrendingUp} label="Projected Monthly" value="$8,500" variant="teal" />
          <StatCard icon={BarChart3} label="Platform Fee" value="15%" />
        </div>
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Claims Filed Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={claimsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215, 12%, 55%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(215, 12%, 55%)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(220, 18%, 7%)", border: "1px solid hsl(220, 14%, 16%)", borderRadius: 8 }} />
              <Bar dataKey="claims" fill="hsl(164, 100%, 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Payouts Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={payoutsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215, 12%, 55%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(215, 12%, 55%)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(220, 18%, 7%)", border: "1px solid hsl(220, 14%, 16%)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="amount" stroke="hsl(164, 100%, 42%)" strokeWidth={2} dot={{ fill: "hsl(164, 100%, 42%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
