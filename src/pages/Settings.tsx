import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { User, Shield, Download, Trash2, FileText, ExternalLink, LogOut } from "lucide-react";

const Settings = () => {
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
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>user@example.com</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="text-primary font-medium">Free</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Member Since</span><span>June 2025</span></div>
        </div>
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

      <Button variant="outline" className="w-full rounded-xl"><LogOut className="mr-2 h-4 w-4" />Log Out</Button>
    </div>
  );
};

export default Settings;
