import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { ClaimStatus } from "@/types";

interface PartnerClaimRow {
  id: string;
  settlement_name: string;
  user_email_masked: string;
  status: ClaimStatus;
  est_payout: number | null;
  filed_at: string | null;
  updated_at: string;
}

const statusOptions = ["all", "submitted", "under_review", "documentation_required", "approved", "rejected", "paid"];

const maskEmail = (userId: string): string => {
  return `user-${userId.slice(0, 4)}••••`;
};

const PartnerClaims = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<PartnerClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;

    const fetchClaims = async () => {
      try {
        const { data } = await supabase
          .from("claims")
          .select("id, status, est_payout, filed_at, updated_at, user_id, settlements(name)")
          .eq("partner_id", user.id)
          .order("updated_at", { ascending: false });

        if (data) {
          setClaims(data.map((c: any) => ({
            id: c.id,
            settlement_name: c.settlements?.name || "Unknown",
            user_email_masked: maskEmail(c.user_id),
            status: c.status,
            est_payout: c.est_payout ? Number(c.est_payout) : null,
            filed_at: c.filed_at,
            updated_at: c.updated_at,
          })));
        }
      } catch (error) {
        console.error("Error fetching partner claims:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [user]);

  const filtered = statusFilter === "all" ? claims : claims.filter(c => c.status === statusFilter);

  return (
    <div>
      <PageHeader title="Assigned Claims" subtitle="Claims assigned to you for review and processing" />

      <div className="mb-4 flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claim ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Est. Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No claims found</td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/partner/claims/${c.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-medium">{c.settlement_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.user_email_masked}</td>
                  <td className="px-4 py-3"><StatusPill variant={c.status} /></td>
                  <td className="px-4 py-3 text-primary font-semibold">{c.est_payout ? `$${c.est_payout.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.filed_at || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartnerClaims;
