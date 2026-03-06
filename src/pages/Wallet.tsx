import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet as WalletIcon, DollarSign, Clock, CheckCircle, TrendingUp, ArrowRight, Loader2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import DirectDepositForm from "@/components/DirectDepositForm";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Wallet = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalRecovered, setTotalRecovered] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [approvedClaims, setApprovedClaims] = useState(0);
  const [eligibleEstimate, setEligibleEstimate] = useState(0);
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);

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
          .select("id, amount, status, paid_at, created_at, claims(settlement_id, settlements(name))")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("claims")
          .select("status, net_payout, est_payout, settlement_id")
          .eq("user_id", user!.id),
        supabase
          .from("settlement_matches")
          .select("payout_estimate, settlement_id")
          .eq("user_id", user!.id),
      ]);

      const payoutRows = (payoutsRes.data || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        paid_at: p.paid_at,
        created_at: p.created_at,
        settlement_name: p.claims?.settlements?.name || "Settlement",
      }));
      setRecentPayouts(payoutRows);

      // All payouts for totals
      const { data: allPayouts } = await supabase
        .from("payouts")
        .select("amount, status")
        .eq("user_id", user!.id);

      const all = allPayouts || [];
      setTotalRecovered(all.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0));
      setPendingAmount(all.filter((p: any) => p.status === "processing").reduce((s: number, p: any) => s + Number(p.amount), 0));

      const claims = claimsRes.data || [];
      setApprovedClaims(claims.filter((c: any) => c.status === "approved" || c.status === "paid").length);

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

  return (
    <div>
      <PageHeader title="Compensation Wallet" subtitle="Your balance overview and payment settings">
        <WalletIcon className="h-5 w-5 text-primary" />
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={<DollarSign className="h-5 w-5 text-success" />} label="Total Recovered" value={`$${totalRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accent="text-success" />
        <SummaryCard icon={<Clock className="h-5 w-5 text-warning" />} label="Pending Payouts" value={`$${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accent="text-warning" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5 text-primary" />} label="Approved Claims" value={String(approvedClaims)} accent="text-primary" />
        <SummaryCard icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />} label="Eligible Estimated" value={`$${eligibleEstimate.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accent="text-muted-foreground" />
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border bg-card overflow-hidden mb-8">
        <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <p className="text-xs text-muted-foreground">Latest payout transactions</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/payouts">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <div className="divide-y">
          {loading ? (
            <div className="px-5 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : recentPayouts.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted-foreground text-sm">No payouts yet. File claims to start recovering funds.</div>
          ) : (
            recentPayouts.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.settlement_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.paid_at || p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    p.status === "paid" ? "bg-success/10 text-success" :
                    p.status === "processing" ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Method */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex items-center justify-between py-3 px-5 rounded-2xl border bg-card mb-2">
            <span className="text-sm font-semibold">Payment Method</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <DirectDepositForm />
        </CollapsibleContent>
      </Collapsible>

      <p className="text-[10px] text-muted-foreground text-center mt-6">
        BreachPay is not a law firm. Payout amounts are estimates based on third-party data and are subject to settlement administrator approval.
      </p>
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

export default Wallet;
