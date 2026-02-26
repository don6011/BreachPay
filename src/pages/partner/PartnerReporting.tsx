import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, DollarSign, CheckCircle, Clock, Loader2, BarChart3 } from "lucide-react";

const PartnerReporting = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [paidCount, setPaidCount] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);
  const [partnerName, setPartnerName] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id, partners(id, name)")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!pu) { setLoading(false); return; }
        const partner = (pu as any).partners;
        setPartnerName(partner.name);

        const { data: assignments } = await supabase
          .from("claim_assignments")
          .select("claims(id, status, final_payout)")
          .eq("partner_id", partner.id);

        const counts: Record<string, number> = {};
        let pc = 0, pt = 0;
        (assignments || []).forEach((a: any) => {
          if (!a.claims) return;
          const s = a.claims.status;
          counts[s] = (counts[s] || 0) + 1;
          if (s === "paid") {
            pc++;
            pt += Number(a.claims.final_payout) || 0;
          }
        });
        setStatusCounts(counts);
        setPaidCount(pc);
        setPaidTotal(pt);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const statuses = ["submitted", "under_review", "documentation_required", "approved", "rejected", "paid"];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="Reports" subtitle={partnerName ? `${partnerName} — Performance Overview` : "Partner Reporting"} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={FileText} label="Total Assigned" value={total} variant="teal" />
        <StatCard icon={CheckCircle} label="Paid Claims" value={paidCount} />
        <StatCard icon={DollarSign} label="Total Payouts" value={`$${paidTotal.toLocaleString()}`} variant="teal" />
        <StatCard icon={BarChart3} label="Paid Rate" value={total > 0 ? `${Math.round(paidCount / total * 100)}%` : "—"} />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Claims by Status</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Count</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 capitalize font-medium">{s.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-right">{statusCounts[s] || 0}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {total > 0 ? `${Math.round((statusCounts[s] || 0) / total * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PartnerReporting;
