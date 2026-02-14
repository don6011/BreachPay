import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, TrendingUp, CreditCard, Loader2, Receipt, Download } from "lucide-react";

interface PayoutRow {
  id: string;
  claim_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  stripe_ref: string | null;
  paid_at: string | null;
  created_at: string;
  user_email?: string;
  settlement_name?: string;
}

const AdminPayouts = () => {
   const { user } = useAuth();
   const [payouts, setPayouts] = useState<PayoutRow[]>([]);
   const [loading, setLoading] = useState(true);

   const exportToCSV = () => {
     const headers = ["User Email", "Settlement", "Amount", "Currency", "Status", "Stripe Ref", "Paid At", "Created At"];
     const rows = payouts.map(p => [
       p.user_email,
       p.settlement_name,
       p.amount,
       p.currency,
       p.status,
       p.stripe_ref || "",
       p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "",
       new Date(p.created_at).toLocaleDateString(),
     ]);

     const csvContent = [
       headers.join(","),
       ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
     ].join("\n");

     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
     const link = document.createElement("a");
     const url = URL.createObjectURL(blob);
     link.setAttribute("href", url);
     link.setAttribute("download", `payouts-${new Date().toISOString().split('T')[0]}.csv`);
     link.style.visibility = "hidden";
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
   };

  useEffect(() => {
    if (!user) return;
    fetchPayouts();
  }, [user]);

  const fetchPayouts = async () => {
    try {
      const { data } = await supabase
        .from("payouts")
        .select("id, claim_id, user_id, amount, currency, status, stripe_ref, paid_at, created_at, claims(settlement_id, settlements(name))")
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) {
        const userIds = [...new Set(data.map((p: any) => p.user_id))];
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, email")
          .in("user_id", userIds);

        const emailMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { emailMap[p.user_id] = p.email || "—"; });

        setPayouts(data.map((p: any) => ({
          id: p.id,
          claim_id: p.claim_id,
          user_id: p.user_id,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          stripe_ref: p.stripe_ref,
          paid_at: p.paid_at,
          created_at: p.created_at,
          user_email: emailMap[p.user_id] || "—",
          settlement_name: p.claims?.settlements?.name || "Unknown",
        })));
      }
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPaid = payouts.filter(p => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const totalProcessing = payouts.filter(p => p.status === "processing").reduce((a, p) => a + p.amount, 0);
  const totalPayouts = payouts.length;
  const avgPayout = totalPayouts > 0 ? Math.round(totalPaid / Math.max(1, payouts.filter(p => p.status === "paid").length)) : 0;

  return (
    <div>
      <PageHeader title="Payout Management" subtitle="All payouts across users with revenue tracking">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={exportToCSV}><Download className="mr-1 h-3 w-3" />Export CSV</Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={DollarSign} label="Total Paid Out" value={`$${totalPaid.toLocaleString()}`} variant="teal" />
        <StatCard icon={CreditCard} label="Processing" value={`$${totalProcessing.toLocaleString()}`} />
        <StatCard icon={Receipt} label="Total Payouts" value={totalPayouts} variant="teal" />
        <StatCard icon={TrendingUp} label="Avg Payout" value={`$${avgPayout.toLocaleString()}`} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stripe Ref</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paid At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No payouts yet</td></tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs">{p.user_email}</td>
                  <td className="px-4 py-3 font-medium">{p.settlement_name}</td>
                  <td className="px-4 py-3 text-primary font-semibold">${p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold capitalize ${
                      p.status === "paid" ? "bg-success/10 text-success" :
                      p.status === "processing" ? "bg-primary/10 text-primary" :
                      "bg-destructive/10 text-destructive"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.stripe_ref || "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPayouts;
