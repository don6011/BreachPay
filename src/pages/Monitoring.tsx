import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AlertRow } from "@/components/AlertRow";
import { StatusPill } from "@/components/StatusPill";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { mockMonitoring, mockAlerts } from "@/data/mockData";
import { Shield, Database, AlertTriangle, Clock, Bell, Mail, Zap, Crown, Check, Lightbulb, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const premiumBenefits = [
  "Daily monitoring scans",
  "Instant email alerts",
  "30-day deadline alerts",
  "Priority settlement matching",
  "Risk trend history + score changes",
  "Priority support",
];

const riskTrendData = [
  { date: "Aug", score: 45 },
  { date: "Sep", score: 52 },
  { date: "Oct", score: 58 },
  { date: "Nov", score: 65 },
  { date: "Dec", score: 72 },
  { date: "Jan", score: 78 },
  { date: "Feb", score: 82 },
];

const protectionTips = [
  { title: "Enable Two-Factor Authentication", description: "Add 2FA on all accounts found in breaches to prevent unauthorized access." },
  { title: "Change Compromised Passwords", description: "Update passwords for all services where your credentials were exposed." },
  { title: "Freeze Your Credit", description: "Contact Equifax, Experian, and TransUnion to place a credit freeze." },
  { title: "Monitor Financial Statements", description: "Review bank and credit card statements weekly for unauthorized charges." },
];

const Monitoring = () => {
  const isPremium = false;

  return (
    <div>
      <PageHeader title="Monitoring Center" subtitle="Your identity monitoring status" />

      {/* Status Card */}
      <div className="mb-6 glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Monitoring Status</h2>
          </div>
          <StatusPill variant={mockMonitoring.active ? "active" : "inactive"} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Clock} label="Last Scan" value={mockMonitoring.last_scan} />
          <StatCard icon={Clock} label="Next Scan" value={mockMonitoring.next_scan} />
          <StatCard icon={Database} label="Databases Scanned" value={mockMonitoring.databases_scanned.toLocaleString()} variant="teal" />
          <StatCard icon={AlertTriangle} label="Breaches Detected" value={mockMonitoring.breaches_detected} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Scan Frequency: {mockMonitoring.scan_frequency}</p>
      </div>

      {/* Risk Trend Graph */}
      <div className="mb-6 glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Risk Score Trend</h2>
          </div>
          {!isPremium && (
            <span className="flex items-center gap-1 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              <Crown className="h-3 w-3" /> Premium — Full History
            </span>
          )}
        </div>
        <div className={!isPremium ? "relative" : ""}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={riskTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(219, 31%, 16%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
              <Line type="monotone" dataKey="score" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ fill: "hsl(0, 84%, 60%)" }} />
            </LineChart>
          </ResponsiveContainer>
          {!isPremium && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] rounded-xl">
              <Button asChild size="sm" className="rounded-xl bg-primary text-primary-foreground">
                <Link to="/pricing"><Crown className="mr-1.5 h-3.5 w-3.5" /> Unlock Full Trend History</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Preferences */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Alert Preferences</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Email Alerts</span></div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Deadline Alerts</span></div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Push Notifications</span></div>
              <Switch disabled />
              <span className="text-xs text-muted-foreground">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Premium Upsell / Active Badge */}
        {isPremium ? (
          <div className="glass-card-glow p-6 flex items-center gap-3">
            <Crown className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-semibold text-primary">Premium Active</h2>
              <p className="text-sm text-muted-foreground">You're getting daily scans, instant alerts, and priority matching.</p>
            </div>
          </div>
        ) : (
          <div className="glass-card-glow p-6">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Upgrade to Premium</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Get advanced monitoring and priority matching — $9.99/mo</p>
            <ul className="space-y-2 mb-5">
              {premiumBenefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300">
              <Link to="/pricing">Upgrade — $9.99/mo</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Identity Protection Tips */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-warning" />
          <h2 className="text-lg font-semibold">Identity Protection Tips</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {protectionTips.map((tip) => (
            <div key={tip.title} className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-1">{tip.title}</h3>
              <p className="text-xs text-muted-foreground">{tip.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert History */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Alert History</h2>
        <div className="space-y-2">
          {mockAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
