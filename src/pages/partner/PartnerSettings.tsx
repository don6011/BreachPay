import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const PartnerSettings = () => {
  const { user, signOut } = useAuth();

  return (
    <div>
      <PageHeader title="Partner Settings" subtitle="Manage your partner account" />

      <div className="glass-card p-6 max-w-lg space-y-4">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Email</label>
          <p className="text-sm mt-1">{user?.email || "—"}</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Role</label>
          <p className="text-sm mt-1">Partner</p>
        </div>
        <div className="pt-4 border-t border-border">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={signOut}>
            <LogOut className="mr-1 h-3 w-3" />Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PartnerSettings;
