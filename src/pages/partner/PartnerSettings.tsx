import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Save, Loader2, Building } from "lucide-react";
import { toast } from "sonner";

interface PartnerProfile {
  display_name: string;
  phone: string;
  firm_name: string | null;
  firm_website: string | null;
  firm_contact_email: string | null;
}

const PartnerSettings = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PartnerProfile>({
    display_name: "",
    phone: "",
    firm_name: null,
    firm_website: null,
    firm_contact_email: null,
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: pp } = await supabase
        .from("partner_profiles")
        .select("display_name, phone, firm_id, partner_firms(name, website, contact_email)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pp) {
        const firm = (pp as any).partner_firms;
        setProfile({
          display_name: pp.display_name || "",
          phone: pp.phone || "",
          firm_name: firm?.name || null,
          firm_website: firm?.website || null,
          firm_contact_email: firm?.contact_email || null,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("partner_profiles")
        .upsert({ user_id: user.id, display_name: profile.display_name || null, phone: profile.phone || null }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <PageHeader title="Partner Settings" subtitle="Manage your partner account and view firm details" />

      <div className="max-w-lg space-y-6">
        {/* Profile */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Profile</h3>
          <div>
            <Label className="mb-1.5">Email</Label>
            <p className="text-sm text-muted-foreground">{user?.email || "—"}</p>
          </div>
          <div>
            <Label className="mb-1.5">Display Name</Label>
            <Input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="rounded-xl" placeholder="Your name" />
          </div>
          <div>
            <Label className="mb-1.5">Phone</Label>
            <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="rounded-xl" placeholder="+1 (555) 000-0000" />
          </div>
          <Button size="sm" className="rounded-xl" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Save Profile
          </Button>
        </div>

        {/* Firm Info (read-only) */}
        {profile.firm_name && (
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4" /> Firm Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Firm Name</span><span className="font-medium">{profile.firm_name}</span></div>
              {profile.firm_website && <div className="flex justify-between"><span className="text-muted-foreground">Website</span><a href={profile.firm_website} target="_blank" rel="noopener noreferrer" className="text-primary underline">{profile.firm_website}</a></div>}
              {profile.firm_contact_email && <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{profile.firm_contact_email}</span></div>}
            </div>
            <p className="text-[10px] text-muted-foreground">Firm details are managed by BreachPay administrators.</p>
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
