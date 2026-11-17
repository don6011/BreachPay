import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MonitoredEmailsManager } from "@/components/MonitoredEmailsManager";
import { User, Shield, Download, Trash2, FileText, ExternalLink, LogOut, Crown, CreditCard, Calendar, CheckCircle, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FEATURES } from "@/config/features";
import { Switch } from "@/components/ui/switch";

/** Lets people turn BreachPay's emails on or off. The emails themselves link here. */
function EmailAlertSettings({ userId }: { userId: string }) {
  const [emailAlerts, setEmailAlerts] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("user_profiles")
      .select("email_alerts")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEmailAlerts(data?.email_alerts ?? true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = async (value: boolean) => {
    const previous = emailAlerts;
    setEmailAlerts(value);
    setSaving(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ email_alerts: value, deadline_alerts: value })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      setEmailAlerts(previous);
      toast.error("Couldn't save that. Please try again.");
    } else {
      toast.success(value ? "Email alerts are on" : "Email alerts are off");
    }
  };

  return (
    <section className="mb-6 rounded-2xl border bg-card p-6">
      <h2 className="font-semibold mb-4">Email alerts</h2>
      <div className="flex items-start justify-between gap-4">
        <label htmlFor="email-alerts" className="text-sm">
          <span className="font-medium">Matches and deadlines</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Emails about listed settlements that may relate to your breach check results, and their claim deadlines.
            Emails you ask for, such as password resets, are always sent.
          </span>
        </label>
        <Switch
          id="email-alerts"
          checked={emailAlerts ?? false}
          disabled={emailAlerts === null || saving}
          onCheckedChange={toggle}
        />
      </div>
    </section>
  );
}

const Settings = () => {
  const { user, signOut, plan } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const isPremium = plan === "premium";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      {/* Account */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user?.email ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Member Since</span><span>{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}</span></div>
          {!FEATURES.paidPlans && (
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>Free. There is no paid plan.</span></div>
          )}
        </div>
      </section>

      {FEATURES.paidPlans && (
      <>
      {/* Plan & Subscription */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Plan & Billing</h2>
        </div>

        {false ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : isPremium ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 font-bold">
                  <Crown className="mr-1 h-3 w-3" /> Premium Active
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl text-xs">Manage Subscription</Button>
            </div>
            <div className="rounded-xl bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Monthly</span>
                <span className="font-medium">$4.99/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Next billing</span>
                <span className="text-muted-foreground">—</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["Monitor up to 5 emails", "Daily scans", "Real-time alerts", "Dark web monitoring", "Priority matching", "Risk scoring", "Auto-claim packets"].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-primary" />{f}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="secondary" className="font-bold">Free Plan</Badge>
                <p className="mt-2 text-sm text-muted-foreground">Weekly scans, batched alerts, standard matching</p>
              </div>
              <Button asChild className="rounded-xl">
                <Link to="/pricing">Upgrade <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Premium — $4.99/mo</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">50% OFF</span>
              </div>
              <p className="text-xs text-muted-foreground">Monitor up to 5 emails · Daily scans · Real-time breach alerts · Dark web monitoring · Priority matching</p>
            </div>
          </div>
        )}
      </section>
      </>
      )}

      {FEATURES.scheduledScans && (
      <>
      {/* Monitored Emails */}
      <MonitoredEmailsManager />

      {/* Monitored Identifiers */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Other Monitored Identifiers</h2>
        </div>
        <p className="text-sm text-muted-foreground">Phone numbers, SSNs, and other identifiers from your scans appear here.</p>
      </section>
      </>
      )}

      {user && <EmailAlertSettings userId={user.id} />}

      {/* Data Controls */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Data Controls</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Download a copy of everything stored for your account. To remove your data, delete your account below.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={exporting}
            onClick={async () => {
              if (!user) return;
              setExporting(true);
              try {
                const [profileRes, breachesRes, claimsRes, alertsRes, scansRes, matchesRes, identifiersRes] = await Promise.all([
                  supabase.from("user_profiles").select("*").eq("user_id", user.id),
                  supabase.from("breach_events").select("source, exposed_fields, breach_year, risk_level, created_at").eq("user_id", user.id),
                  supabase.from("claims").select("id, status, est_payout, net_payout, created_at, filed_at, submission_channel, settlement_id").eq("user_id", user.id),
                  supabase.from("alerts").select("title, body, type, severity, created_at, is_read").eq("user_id", user.id),
                  supabase.from("scan_runs").select("risk_score, breaches_detected, databases_scanned, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
                  supabase.from("settlement_matches").select("settlement_id, payout_estimate, match_confidence, created_at").eq("user_id", user.id),
                  supabase.from("monitored_identifiers").select("type, value_last4, display_label, is_active, verified, created_at").eq("user_id", user.id),
                ]);

                const exportData = {
                  exported_at: new Date().toISOString(),
                  account: {
                    email: user.email,
                    created_at: user.created_at,
                  },
                  profile: profileRes.data ?? [],
                  breach_events: breachesRes.data ?? [],
                  claims: claimsRes.data ?? [],
                  alerts: alertsRes.data ?? [],
                  scan_runs: scansRes.data ?? [],
                  settlement_matches: matchesRes.data ?? [],
                  monitored_identifiers: identifiersRes.data ?? [],
                };

                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `breachpay-data-export-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data exported successfully");
              } catch (err) {
                console.error("Export error:", err);
                toast.error("Failed to export data. Please try again.");
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? "Exporting…" : "Export My Data"}
          </Button>
        </div>
      </section>

      {/* Delete Account */}
      <section className="mb-6 rounded-2xl border border-destructive/30 bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="font-semibold text-destructive">Delete Account</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and everything stored with it: your profile, breach check results, matches and claim records. This cannot be undone.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full rounded-xl"
            disabled={deleteConfirmText !== "DELETE" || deletingAccount}
            onClick={async () => {
              if (!user || deleteConfirmText !== "DELETE") return;
              setDeletingAccount(true);
              try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession?.access_token) {
                  toast.error("Please log in again before deleting your account.");
                  return;
                }
                const res = await supabase.functions.invoke("delete-account", {
                  headers: { Authorization: `Bearer ${currentSession.access_token}` },
                });
                if (res.error || res.data?.error) {
                  toast.error(res.data?.error || "Failed to delete account. Please try again.");
                } else {
                  toast.success("Your account has been permanently deleted.");
                  await signOut();
                  navigate("/");
                }
              } catch (err) {
                console.error("Delete account error:", err);
                toast.error("Something went wrong. Please try again.");
              } finally {
                setDeletingAccount(false);
              }
            }}
          >
            {deletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {deletingAccount ? "Deleting Account…" : "Permanently Delete Account"}
          </Button>
        </div>
      </section>

      {/* Legal */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-3">Legal</h2>
        <div className="space-y-2">
          <Link to="/terms" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" />Terms of Service<ExternalLink className="h-3 w-3" />
          </Link>
          <Link to="/privacy" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" />Privacy Policy<ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          BreachPay is not a law firm and does not provide legal advice. All settlement data is sourced from third parties.
        </p>
      </section>

      <Button variant="outline" className="w-full rounded-xl" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Log Out</Button>
    </div>
  );
};

export default Settings;
