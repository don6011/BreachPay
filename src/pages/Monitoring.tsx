import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AlertRow } from "@/components/AlertRow";
import { StatusPill } from "@/components/StatusPill";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useScanSchedule, useUpsertSchedule } from "@/hooks/useScanSchedule";
import { Shield, Database, AlertTriangle, Clock, Bell, Mail, Zap, Crown, Check, Lightbulb, Activity, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "@/hooks/use-toast";

const premiumBenefits = [
  "Daily monitoring scans",
  "Instant email alerts",
  "30-day deadline alerts",
  "Priority settlement matching",
  "Risk trend history + score changes",
  "Priority support",
];

const protectionTips = [
  { title: "Enable Two-Factor Authentication", description: "Add 2FA on all accounts found in breaches to prevent unauthorized access." },
  { title: "Change Compromised Passwords", description: "Update passwords for all services where your credentials were exposed." },
  { title: "Freeze Your Credit", description: "Contact Equifax, Experian, and TransUnion to place a credit freeze." },
  { title: "Monitor Financial Statements", description: "Review bank and credit card statements weekly for unauthorized charges." },
];

interface UserProfile {
  monitoring_enabled: boolean;
  last_scan_at: string | null;
  next_scan_at: string | null;
  scan_frequency_days: number;
  plan: string;
  email_alerts: boolean;
  deadline_alerts: boolean;
  push_alerts: boolean;
}

const Monitoring = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [riskTrend, setRiskTrend] = useState<{ date: string; score: number }[]>([]);
  const [breachCount, setBreachCount] = useState(0);
  const [dbsScanned, setDbsScanned] = useState(0);
  const [loading, setLoading] = useState(true);

  const { data: schedule } = useScanSchedule();
  const upsertSchedule = useUpsertSchedule();

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      try {
        // User profile
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("monitoring_enabled, last_scan_at, next_scan_at, scan_frequency_days, plan, email_alerts, deadline_alerts, push_alerts")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileData) setProfile(profileData);

        // Alerts
        const { data: alertsData } = await supabase
          .from("alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
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

        // Risk trend (snapshots)
        const { data: snapshots } = await supabase
          .from("user_risk_snapshots")
          .select("risk_score, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(20);
        if (snapshots && snapshots.length > 0) {
          setRiskTrend(snapshots.map(s => ({
            date: new Date(s.created_at).toLocaleDateString("en-US", { month: "short" }),
            score: s.risk_score,
          })));
          setBreachCount(snapshots[snapshots.length - 1].risk_score > 0 ? snapshots.length : 0);
        }

        // Get latest scan for databases scanned
        const { data: latestScan } = await supabase
          .from("scan_runs")
          .select("databases_scanned, breaches_detected")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestScan) {
          setDbsScanned(latestScan.databases_scanned);
          setBreachCount(latestScan.breaches_detected);
        }
      } catch (error) {
        console.error("Monitoring fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  const isPremium = profile?.plan === "premium";
  const scanFreqLabel = isPremium ? "Daily (Premium)" : `Every ${profile?.scan_frequency_days || 7} days (Free Plan)`;

  const handleToggle = async (field: "email_alerts" | "deadline_alerts" | "monitoring_enabled", value: boolean) => {
    if (!user) return;
    await supabase.from("user_profiles").update({ [field]: value }).eq("user_id", user.id);
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
    toast({ title: "Updated", description: `${field.replace(/_/g, " ")} ${value ? "enabled" : "disabled"}` });
  };

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
          <StatusPill variant={profile?.monitoring_enabled ? "active" : "inactive"} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Clock} label="Last Scan" value={profile?.last_scan_at ? new Date(profile.last_scan_at).toLocaleDateString() : "Never"} />
          <StatCard icon={Clock} label="Next Scan" value={profile?.next_scan_at ? new Date(profile.next_scan_at).toLocaleDateString() : "—"} />
          <StatCard icon={Database} label="Databases Scanned" value={dbsScanned.toLocaleString()} variant="teal" />
          <StatCard icon={AlertTriangle} label="Breaches Detected" value={breachCount} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Scan Frequency: {scanFreqLabel}</p>
      </div>

      {/* Scheduled Scan Card */}
      <div className="mb-6 glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Scheduled Scans</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-scan enabled</p>
              <p className="text-xs text-muted-foreground">Automatically run breach scans on a schedule</p>
            </div>
            <Switch
              checked={schedule?.is_enabled ?? false}
              onCheckedChange={(v) => upsertSchedule.mutate({ is_enabled: v, frequency: schedule?.frequency ?? "daily" })}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Frequency</p>
            <Select
              value={schedule?.frequency ?? "daily"}
              onValueChange={(v) => upsertSchedule.mutate({ is_enabled: schedule?.is_enabled ?? true, frequency: v })}
            >
              <SelectTrigger className="w-32 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {schedule?.next_run_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Next scheduled run</span>
              <span>{new Date(schedule.next_run_at).toLocaleString()}</span>
            </div>
          )}
          {schedule?.last_run_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last run</span>
              <span>{new Date(schedule.last_run_at).toLocaleString()}</span>
            </div>
          )}
        </div>
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
          {riskTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={riskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(219, 31%, 16%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(217, 16%, 62%)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(221, 45%, 7%)", border: "1px solid hsl(219, 31%, 16%)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="score" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ fill: "hsl(0, 84%, 60%)" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              No risk data yet. Run a scan to start tracking.
            </div>
          )}
          {!isPremium && riskTrend.length > 0 && (
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
              <Switch checked={profile?.email_alerts ?? true} onCheckedChange={(v) => handleToggle("email_alerts", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Deadline Alerts</span></div>
              <Switch checked={profile?.deadline_alerts ?? true} onCheckedChange={(v) => handleToggle("deadline_alerts", v)} />
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
            <p className="text-sm text-muted-foreground mb-4">Get advanced monitoring and priority matching — $4.99/mo</p>
            <ul className="space-y-2 mb-5">
              {premiumBenefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300">
              <Link to="/pricing">Upgrade — $4.99/mo</Link>
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
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No alerts yet</p>
          ) : (
            alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
