import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AlertRow } from "@/components/AlertRow";
import { StatusPill } from "@/components/StatusPill";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { mockMonitoring, mockAlerts } from "@/data/mockData";
import { Shield, Database, AlertTriangle, Clock, Bell, Mail, Zap, Crown, Check } from "lucide-react";
import { Link } from "react-router-dom";

const premiumBenefits = [
  "Daily monitoring scans",
  "Instant email alerts",
  "30-day deadline alerts",
  "Priority settlement matching",
  "Risk trend history + score changes",
  "Priority support",
];

const Monitoring = () => {
  // TODO: read from user_profiles.plan when wired to Supabase
  const isPremium = false;

  return (
    <div>
      <PageHeader title="Monitoring Center" subtitle="Your identity monitoring status" />

      {/* Status Card */}
      <div className="mb-6 rounded-2xl border border-primary/20 bg-card p-6 shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)]">
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Preferences */}
        <div className="rounded-2xl border bg-card p-6">
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
          <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)] flex items-center gap-3">
            <Crown className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-semibold text-primary">Premium Active</h2>
              <p className="text-sm text-muted-foreground">You're getting daily scans, instant alerts, and priority matching.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)]">
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
