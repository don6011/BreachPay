import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Flag } from "lucide-react";

interface ClaimRow {
  id: string;
  settlement_name: string;
  status: string;
  est_payout: number;
  filed_at: string | null;
  updated_at: string;
  user_email: string | null;
}

const AdminClaims = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchClaims = async () => {
      try {
        const { data } = await supabase
          .from("claims")
          .select(`
            id, status, est_payout, filed_at, updated_at, user_id,
            settlements(name)
          `)
          .order("created_at", { ascending: false })
          .limit(200);

        if (data) {
          // Get user emails for display
          const userIds = [...new Set(data.map((c: any) => c.user_id))];
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, email")
            .in("user_id", userIds);

          const emailMap: Record<string, string> = {};
          profiles?.forEach((p: any) => { emailMap[p.user_id] = p.email || ""; });

          setClaims(data.map((c: any) => ({
            id: c.id,
            settlement_name: c.settlements?.name || "Unknown",
            status: c.status,
            est_payout: Number(c.est_payout) || 0,
            filed_at: c.filed_at,
            updated_at: c.updated_at,
            user_email: emailMap[c.user_id] || "—",
          })));
        }
      } catch (error) {
        console.error("Error fetching admin claims:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [user]);

  return (
    <div>
      <PageHeader title="Claims Management" subtitle="Review and manage filed claims">
        <Button size="sm" variant="outline" className="rounded-xl"><Download className="mr-1 h-3 w-3" />Export CSV</Button>
        <Button size="sm" variant="outline" className="rounded-xl"><Flag className="mr-1 h-3 w-3" />Flag Suspicious</Button>
      </PageHeader>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No claims yet</td></tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{c.user_email}</td>
                  <td className="px-4 py-3 font-medium">{c.settlement_name}</td>
                  <td className="px-4 py-3"><StatusPill variant={c.status as any} /></td>
                  <td className="px-4 py-3 text-primary">${c.est_payout.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{c.filed_at || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminClaims;
