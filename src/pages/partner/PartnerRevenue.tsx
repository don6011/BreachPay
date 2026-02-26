import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, Clock, CheckCircle, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

const PartnerRevenue = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!pu) { setLoading(false); return; }
        setPartnerId(pu.partner_id);

        const [refRes, invRes] = await Promise.all([
          supabase.from("referrals").select("*").eq("partner_id", pu.partner_id).order("created_at", { ascending: false }),
          supabase.from("partner_invoices").select("*").eq("partner_id", pu.partner_id).order("created_at", { ascending: false }),
        ]);
        setReferrals(refRes.data || []);
        setInvoices(invRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const totalEarned = referrals.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
  const totalPending = referrals.reduce((sum, r) => sum + (Number(r.amount_expected) || 0), 0) - totalEarned;
  const paidInvoices = invoices.filter(i => i.status === "paid").length;
  const pendingInvoices = invoices.filter(i => i.status !== "paid").length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="Revenue" subtitle="CPA earnings and invoice tracking" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={DollarSign} label="Total Earned" value={`$${totalEarned.toLocaleString()}`} variant="teal" />
        <StatCard icon={Clock} label="Pending" value={`$${Math.max(0, totalPending).toLocaleString()}`} />
        <StatCard icon={CheckCircle} label="Paid Invoices" value={paidInvoices} />
        <StatCard icon={FileText} label="Pending Invoices" value={pendingInvoices} />
      </div>

      {/* Invoices */}
      <h2 className="text-lg font-semibold mb-4">Invoices</h2>
      <div className="rounded-2xl border bg-card overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No invoices yet</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-xs">
                  {format(new Date(inv.period_start), "MMM d")} – {format(new Date(inv.period_end), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3 font-semibold text-primary">${Number(inv.subtotal).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    inv.status === "paid" ? "bg-success/10 text-success" :
                    inv.status === "sent" ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Referrals */}
      <h2 className="text-lg font-semibold mb-4">Referral Earnings</h2>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Model</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expected</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paid</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {referrals.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No referrals yet</td></tr>
            ) : referrals.map((ref) => (
              <tr key={ref.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(ref.created_at), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 uppercase text-xs font-medium">{ref.model}</td>
                <td className="px-4 py-3">${Number(ref.amount_expected || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-primary font-semibold">${Number(ref.amount_paid || 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ref.status === "paid" ? "bg-success/10 text-success" :
                    ref.status === "invoiced" ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>{ref.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartnerRevenue;
