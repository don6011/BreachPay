import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Search } from "lucide-react";

interface AdminUserRow {
  user_id: string;
  email: string | null;
  plan: string;
  monitoring_enabled: boolean;
  created_at: string;
  breaches: number;
  matches: number;
  claims: number;
  estimated_value: number;
}

const AdminUsers = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        // Get all user profiles (admin RLS allows this)
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, email, plan, monitoring_enabled, created_at")
          .order("created_at", { ascending: false });

        if (!profiles) { setLoading(false); return; }

        // For each user, get aggregated counts
        const enriched: AdminUserRow[] = await Promise.all(
          profiles.map(async (p) => {
            const [breachRes, matchRes, claimRes] = await Promise.all([
              supabase.from("breach_events").select("*", { count: "exact", head: true }).eq("user_id", p.user_id),
              supabase.from("settlement_matches").select("payout_estimate", { count: "exact" }).eq("user_id", p.user_id),
              supabase.from("claims").select("est_payout", { count: "exact" }).eq("user_id", p.user_id),
            ]);

            const matchPayout = matchRes.data
              ? matchRes.data.reduce((a: number, m: any) => a + (Number(m.payout_estimate) || 0), 0)
              : 0;

            return {
              user_id: p.user_id,
              email: p.email,
              plan: p.plan,
              monitoring_enabled: p.monitoring_enabled,
              created_at: p.created_at,
              breaches: breachRes.count || 0,
              matches: matchRes.count || 0,
              claims: claimRes.count || 0,
              estimated_value: matchPayout,
            };
          })
        );

        setUsers(enriched);
      } catch (error) {
        console.error("Error fetching admin users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  const filtered = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage registered users">
        <Button variant="outline" size="sm" className="rounded-xl"><Download className="mr-1 h-3 w-3" />Export CSV</Button>
      </PageHeader>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Breaches</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matches</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claims</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Est. Value</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.email || "—"}</td>
                  <td className="px-4 py-3">{u.breaches}</td>
                  <td className="px-4 py-3">{u.matches}</td>
                  <td className="px-4 py-3">{u.claims}</td>
                  <td className="px-4 py-3 text-primary">${u.estimated_value.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusPill variant={u.plan === "premium" ? "active" : "open"} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
