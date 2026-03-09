import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MonitoredEmailsManager } from "@/components/MonitoredEmailsManager";
import { User, Shield, Download, Trash2, FileText, ExternalLink, LogOut, Crown, CreditCard, Calendar, CheckCircle, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Settings = () => {
  const { user, signOut, plan } = useAuth();
  const navigate = useNavigate();
  const loading = false;

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
        </div>
      </section>

      {/* Plan & Subscription */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Plan & Billing</h2>
        </div>

        {loading ? (
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
              {["Daily scans", "Real-time alerts", "Dark web monitoring", "Priority matching", "Risk scoring", "Auto-claim packets"].map(f => (
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
              <p className="text-xs text-muted-foreground">Daily scans · Real-time breach alerts · Dark web monitoring · Priority matching</p>
            </div>
          </div>
        )}
      </section>

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

      {/* Data Controls */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Data Controls</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Your data is encrypted at rest. Documents are stored securely with time-limited access. Monitored identifiers are stored as hashes, never plaintext.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl"><Download className="mr-2 h-4 w-4" />Export My Data</Button>
          <Button variant="destructive" className="rounded-xl" onClick={async () => {
            if (!user) return;
            if (!confirm("Are you sure you want to request deletion of all your data? This action cannot be undone.")) return;
            const { error } = await supabase.from("data_deletion_requests").insert({
              user_id: user.id,
              reason: "User-initiated deletion request",
            } as any);
            if (error) {
              alert("Failed to submit request. Please try again.");
            } else {
              alert("Your data deletion request has been submitted. We will process it within 30 days.");
            }
          }}><Trash2 className="mr-2 h-4 w-4" />Request Data Deletion</Button>
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
