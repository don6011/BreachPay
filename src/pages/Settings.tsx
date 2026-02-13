import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { User, Shield, Download, Trash2, FileText, ExternalLink, LogOut, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // TODO: read from user_profiles.plan when wired to Supabase
  const isPremium = false;

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

      {/* Plan */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Plan</h2>
        </div>
        {isPremium ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Premium Active</span>
              <p className="mt-2 text-sm text-muted-foreground">$9.99/mo · Daily scans, instant alerts, priority matching</p>
            </div>
            <Button variant="outline" className="rounded-xl text-sm">Manage</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">Free</span>
              <p className="mt-2 text-sm text-muted-foreground">Weekly scans, batched alerts, standard matching</p>
            </div>
            <Button asChild className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300 text-sm">
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Monitored Identifiers */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Monitored Identifiers</h2>
        </div>
        <p className="text-sm text-muted-foreground">No identifiers being monitored. Run a scan to get started.</p>
      </section>

      {/* Data Controls */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Data Controls</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl"><Download className="mr-2 h-4 w-4" />Export My Data</Button>
          <Button variant="destructive" className="rounded-xl"><Trash2 className="mr-2 h-4 w-4" />Delete Account</Button>
        </div>
      </section>

      {/* Legal */}
      <section className="mb-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-3">Legal</h2>
        <div className="space-y-2">
          {["Terms of Service", "Privacy Policy", "Disclaimer"].map((link) => (
            <a key={link} href="#" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <FileText className="h-3.5 w-3.5" />{link}<ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </section>

      <Button variant="outline" className="w-full rounded-xl" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Log Out</Button>
    </div>
  );
};

export default Settings;
