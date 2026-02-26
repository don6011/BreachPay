import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Loader2, Building, Shield, Users, Trash2 } from "lucide-react";

interface PartnerInfo {
  partner_name: string;
  partner_type: string;
  website: string | null;
  contact_email: string | null;
  role: string;
  partner_id: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

const PartnerSettings = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<PartnerInfo | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: pu } = await supabase
        .from("partner_users")
        .select("role, partner_id, partners(name, partner_type, website, contact_email)")
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
          partner_id: pu.partner_id,
        });

        // Fetch team members
        const { data: members } = await supabase
          .from("partner_users")
          .select("id, user_id, role, created_at")
          .eq("partner_id", pu.partner_id)
          .order("created_at", { ascending: true });

        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, email")
            .in("user_id", userIds);

          const emailMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { emailMap[p.user_id] = p.email || "—"; });

          setTeam(members.map(m => ({
            id: m.id,
            user_id: m.user_id,
            email: emailMap[m.user_id] || m.user_id.slice(0, 8) + "…",
            role: m.role,
            created_at: m.created_at,
          })));
        }
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

      <div className="max-w-2xl space-y-6">
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

        {/* Team Members */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4" /> Team Members ({team.length})
          </h3>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members found</p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{m.email}</span>
                        {m.user_id === user?.id && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>}
                      </td>
                      <td className="px-4 py-2.5 capitalize">{m.role}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Contact your BreachPay administrator to add or remove team members.</p>
        </div>

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
