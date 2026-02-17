import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet as WalletIcon, DollarSign, Clock, CheckCircle, TrendingUp, ExternalLink, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PayoutRow {
  id: string;
  claim_id: string;
  amount: number;
  currency: string;
  status: string;
  stripe_ref: string | null;
  paid_at: string | null;
  created_at: string;
  settlement_name?: string;
}

const Wallet = () => {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRow | null>(null);

  // Summary stats
  const [totalRecovered, setTotalRecovered] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [approvedClaims, setApprovedClaims] = useState(0);
  const [eligibleEstimate, setEligibleEstimate] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [payoutsRes, claimsRes, matchesRes] = await Promise.all([
        supabase
          .from("payouts")
          .select("id, claim_id, amount, currency, status, stripe_ref, paid_at, created_at, claims(settlement_id, settlements(name))")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("claims")
          .select("status, net_payout, est_payout")
          .eq("user_id", user!.id),
        supabase
          .from("settlement_matches")
          .select("payout_estimate, settlement_id")
          .eq("user_id", user!.id),
      ]);

      const payoutRows: PayoutRow[] = (payoutsRes.data || []).map((p: any) => ({
        id: p.id,
        claim_id: p.claim_id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        stripe_ref: p.stripe_ref,
        paid_at: p.paid_at,
        created_at: p.created_at,
        settlement_name: p.claims?.settlements?.name || "Settlement",
      }));
      setPayouts(payoutRows);

      // Totals
      setTotalRecovered(payoutRows.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0));
      setPendingAmount(payoutRows.filter(p => p.status === "processing").reduce((s, p) => s + p.amount, 0));

      const claims = claimsRes.data || [];
      setApprovedClaims(claims.filter((c: any) => c.status === "approved" || c.status === "paid").length);

      // Eligible = settlement match estimates for matches not yet filed as claims
      const filedSettlementIds = new Set(claims.map((c: any) => c.settlement_id));
      const matches = matchesRes.data || [];
      setEligibleEstimate(
        matches
          .filter((m: any) => !filedSettlementIds.has(m.settlement_id))
          .reduce((s: number, m: any) => s + (Number(m.payout_estimate) || 0), 0)
      );
    } catch (err) {
      console.error("Wallet fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const FEE_PERCENT = 15;

  return (
    <div>
      <PageHeader title="Compensation Wallet" subtitle="Track your payouts and recovered funds">
        <WalletIcon className="h-5 w-5 text-primary" />
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={<DollarSign className="h-5 w-5 text-success" />} label="Total Recovered" value={`$${totalRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accent="text-success" />
        <SummaryCard icon={<Clock className="h-5 w-5 text-warning" />} label="Pending Payouts" value={`$${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accent="text-warning" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5 text-primary" />} label="Approved Claims" value={String(approvedClaims)} accent="text-primary" />
        <SummaryCard icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />} label="Eligible Estimated" value={`$${eligibleEstimate.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accent="text-muted-foreground" />
      </div>

      {/* Payout Ledger */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Payout History</h3>
          <p className="text-xs text-muted-foreground">All payouts are subject to settlement administrator approval</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No payouts yet. File claims to start recovering funds.</td></tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 font-medium">{p.settlement_name}</td>
                  <td className="px-5 py-3 text-right font-semibold text-primary">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                      p.status === "paid" ? "bg-success/10 text-success" :
                      p.status === "processing" ? "bg-warning/10 text-warning" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {p.status === "paid" && <CheckCircle className="h-3 w-3" />}
                      {p.status === "processing" && <Clock className="h-3 w-3" />}
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
        BreachPay is not a law firm. Payout amounts are estimates based on third-party data and are subject to settlement administrator approval.
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
                  <span className="text-muted-foreground">Gross Payout</span>
                  <span className="font-semibold text-primary">
                    ${(selectedPayout.amount / (1 - FEE_PERCENT / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee ({FEE_PERCENT}%)</span>
                  <span className="font-medium text-warning">
                    -${((selectedPayout.amount / (1 - FEE_PERCENT / 100)) * FEE_PERCENT / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="font-semibold">Net Payout</span>
                  <span className="font-bold text-success">${selectedPayout.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {selectedPayout.stripe_ref && (
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reference</p>
                  <p className="text-xs font-mono break-all">{selectedPayout.stripe_ref}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</p>
                <TimelineStep label="Initiated" date={selectedPayout.created_at} done />
                <TimelineStep label="Processing" date={selectedPayout.created_at} done={selectedPayout.status !== "failed"} />
                <TimelineStep label="Issued" date={selectedPayout.paid_at} done={selectedPayout.status === "paid"} />
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Payouts are processed in test mode. Amounts are subject to settlement administrator approval.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function TimelineStep({ label, date, done }: { label: string; date: string | null; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${done ? "bg-primary" : "bg-muted-foreground/30"}`} />
      <div className="flex-1 flex items-center justify-between">
        <span className={`text-xs ${done ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
        {date && done && <span className="text-[10px] text-muted-foreground">{new Date(date).toLocaleString()}</span>}
      </div>
    </div>
  );
}

export default Wallet;
