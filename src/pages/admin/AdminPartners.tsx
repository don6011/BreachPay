import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, FileText, DollarSign, CheckCircle, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PartnerRow {
  user_id: string;
  email: string;
  created_at: string;
  total_claims: number;
  submitted: number;
  under_review: number;
  approved: number;
  rejected: number;
  paid: number;
  total_payout: number;
}

const AdminPartners = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      try {
        // Get all users with partner role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, created_at")
          .eq("role", "partner");

        if (!roles || roles.length === 0) {
          setLoading(false);
          return;
        }

        const partnerIds = roles.map((r) => r.user_id);

        // Fetch profiles and claims in parallel
        const [profilesRes, claimsRes] = await Promise.all([
          supabase.from("user_profiles").select("user_id, email").in("user_id", partnerIds),
          supabase.from("claims").select("partner_id, status, est_payout, final_payout").in("partner_id", partnerIds),
        ]);

        const emailMap: Record<string, string> = {};
        profilesRes.data?.forEach((p) => {
          emailMap[p.user_id] = p.email || "—";
        });

        // Aggregate claims per partner
        const statsMap: Record<string, Omit<PartnerRow, "user_id" | "email" | "created_at">> = {};
        partnerIds.forEach((id) => {
          statsMap[id] = { total_claims: 0, submitted: 0, under_review: 0, approved: 0, rejected: 0, paid: 0, total_payout: 0 };
        });

        claimsRes.data?.forEach((c: any) => {
          const pid = c.partner_id;
          if (!pid || !statsMap[pid]) return;
          statsMap[pid].total_claims++;
          if (c.status in statsMap[pid]) {
            (statsMap[pid] as any)[c.status]++;
          }
          statsMap[pid].total_payout += Number(c.final_payout || c.est_payout) || 0;
        });

        const rows: PartnerRow[] = roles.map((r) => ({
          user_id: r.user_id,
          email: emailMap[r.user_id] || "—",
          created_at: r.created_at,
          ...statsMap[r.user_id],
        }));

        setPartners(rows);
      } catch (err) {
        console.error("Error fetching partners:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user]);

  const filtered = partners.filter((p) =>
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  const totals = partners.reduce(
    (acc, p) => ({
      partners: acc.partners + 1,
      claims: acc.claims + p.total_claims,
      approved: acc.approved + p.approved + p.paid,
      payout: acc.payout + p.total_payout,
    }),
    { partners: 0, claims: 0, approved: 0, payout: 0 }
  );

  return (
    <div>
      <PageHeader title="Partner Management" subtitle="View partners and their assigned claim performance" />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Partners" value={totals.partners} variant="teal" />
        <StatCard icon={FileText} label="Assigned Claims" value={totals.claims} />
        <StatCard icon={CheckCircle} label="Approved / Paid" value={totals.approved} />
        <StatCard icon={DollarSign} label="Total Payout Value" value={`$${totals.payout.toLocaleString()}`} />
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search partners..." className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partner Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Claims</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submitted</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Under Review</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Approved</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rejected</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paid</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout Value</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No partners found</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.email}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{p.total_claims}</td>
                  <td className="px-4 py-3">{p.submitted}</td>
                  <td className="px-4 py-3">{p.under_review}</td>
                  <td className="px-4 py-3">{p.approved}</td>
                  <td className="px-4 py-3">{p.rejected}</td>
                  <td className="px-4 py-3">{p.paid}</td>
                  <td className="px-4 py-3 text-primary">${p.total_payout.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPartners;
