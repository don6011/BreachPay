import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Loader2, Building, Shield } from "lucide-react";

interface PartnerInfo {
  partner_name: string;
  partner_type: string;
  website: string | null;
  contact_email: string | null;
  role: string;
}

const PartnerSettings = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<PartnerInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: pu } = await supabase
        .from("partner_users")
        .select("role, partners(name, partner_type, website, contact_email)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (pu) {
        const p = (pu as any).partners;
        setInfo({
          partner_name: p?.name || "Unknown",
          partner_type: p?.partner_type || "unknown",
          website: p?.website || null,
          contact_email: p?.contact_email || null,
          role: pu.role,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <PageHeader title="Partner Settings" subtitle="Your partner account and organization details" />

      <div className="max-w-lg space-y-6">
        {/* Profile */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Account</h3>
          <div>
            <Label className="mb-1.5">Email</Label>
            <p className="text-sm text-muted-foreground">{user?.email || "—"}</p>
          </div>
          <div>
            <Label className="mb-1.5">Portal Role</Label>
            <p className="text-sm flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="capitalize font-medium">{info?.role || "agent"}</span>
            </p>
          </div>
        </div>

        {/* Organization Info (read-only) */}
        {info && (
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4" /> Organization
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{info.partner_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{info.partner_type.replace("_", " ")}</span></div>
              {info.website && <div className="flex justify-between"><span className="text-muted-foreground">Website</span><a href={info.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">{info.website}</a></div>}
              {info.contact_email && <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{info.contact_email}</span></div>}
            </div>
            <p className="text-[10px] text-muted-foreground">Organization details are managed by BreachPay administrators.</p>
          </div>
        )}

        {/* Sign Out */}
        <div className="glass-card p-6">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={signOut}>
            <LogOut className="mr-1 h-3 w-3" />Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PartnerSettings;
