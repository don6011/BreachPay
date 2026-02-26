import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Clock, CheckCircle, ArrowRight, Loader2, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface PayoutRow {
  id: string;
  claim_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  external_ref: string | null;
  paid_at: string | null;
  created_at: string;
  settlement_name: string;
}

const Payouts = () => {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRow | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchPayouts();
  }, [user]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("payouts")
        .select("id, claim_id, amount, currency, status, method, external_ref, paid_at, created_at, claims(settlement_id, settlements(name))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      setPayouts(
        (data || []).map((p: any) => ({
          id: p.id,
          claim_id: p.claim_id,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          method: p.method || null,
          external_ref: p.external_ref || null,
          paid_at: p.paid_at,
          created_at: p.created_at,
          settlement_name: p.claims?.settlements?.name || "Settlement",
        }))
      );
    } catch (err) {
      console.error("Payouts fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalEarned = payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payouts.filter(p => p.status === "pending" || p.status === "processing").reduce((s, p) => s + p.amount, 0);
  const paidCount = payouts.filter(p => p.status === "paid").length;

  return (
    <div>
      <PageHeader title="Payouts" subtitle="Track all payments from your filed claims">
        <Banknote className="h-5 w-5 text-primary" />
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-5 w-5 text-success" />
            <span className="text-xs font-medium">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-success">${totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 text-warning" />
            <span className="text-xs font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-warning">${pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Completed Payouts</span>
          </div>
          <p className="text-2xl font-bold text-primary">{paidCount}</p>
        </div>
      </div>

      {/* Payout Ledger */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Payout Ledger</h3>
          <p className="text-xs text-muted-foreground">All amounts are net after platform fee</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Method</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No payouts yet. File claims to start recovering funds.</td></tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-xs">
                    {p.paid_at ? format(new Date(p.paid_at), "MMM d, yyyy") : format(new Date(p.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-5 py-3 font-medium">{p.settlement_name}</td>
                  <td className="px-5 py-3 text-xs capitalize">{p.method && p.method !== "unknown" ? p.method.replace(/_/g, " ") : "—"}</td>
                  <td className="px-5 py-3 text-right font-semibold text-primary">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                      p.status === "paid" ? "bg-success/10 text-success" :
                      p.status === "pending" || p.status === "processing" ? "bg-warning/10 text-warning" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {p.status === "paid" && <CheckCircle className="h-3 w-3" />}
                      {(p.status === "pending" || p.status === "processing") && <Clock className="h-3 w-3" />}
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedPayout(p)}>
                      Details <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-6">
        Payout amounts are subject to settlement administrator approval. BreachPay is not a law firm.
      </p>

      {/* Payout Detail Dialog */}
      <Dialog open={!!selectedPayout} onOpenChange={(open) => !open && setSelectedPayout(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Payout Details
            </DialogTitle>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Settlement</span>
                  <span className="font-medium">{selectedPayout.settlement_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-success">${selectedPayout.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {selectedPayout.method && selectedPayout.method !== "unknown" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium capitalize">{selectedPayout.method.replace(/_/g, " ")}</span>
                  </div>
                )}
                {selectedPayout.external_ref && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs">{selectedPayout.external_ref}</span>
                  </div>
                )}
                {selectedPayout.paid_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid At</span>
                    <span className="font-medium">{format(new Date(selectedPayout.paid_at), "MMM d, yyyy h:mm a")}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</p>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Created</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(selectedPayout.created_at), "MMM d, h:mm a")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${selectedPayout.status === "paid" ? "bg-success" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 flex items-center justify-between">
                    <span className={`text-xs ${selectedPayout.status === "paid" ? "font-medium" : "text-muted-foreground"}`}>Paid</span>
                    {selectedPayout.paid_at && <span className="text-[10px] text-muted-foreground">{format(new Date(selectedPayout.paid_at), "MMM d, h:mm a")}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payouts;