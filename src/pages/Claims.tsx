import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { Wallet, Clock, CheckCircle, DollarSign, CreditCard, Crown, TrendingUp, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { ClaimStatus } from "@/types";

const statusSteps: ClaimStatus[] = ["draft", "submitted", "under_review", "approved", "paid"];

interface PayoutData {
  id: string;
  amount: number;
  status: string;
  claim_id: string;
  paid_at: string | null;
  stripe_ref: string | null;
}

interface ClaimData {
  id: string;
  settlement_id: string;
  status: string;
  est_payout: number;
  final_payout: number | null;
  net_payout: number | null;
  platform_fee: number | null;
  filed_at: string | null;
  updated_at: string;
  settlement_name?: string;
  estimated_payout?: number;
}

const Claims = () => {
  const { user, plan } = useAuth();
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [matchEstimate, setMatchEstimate] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPremium = plan === "premium";

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [claimsRes, payoutsRes, matchesRes] = await Promise.all([
          supabase
            .from("claims")
            .select(`id, settlement_id, status, est_payout, final_payout, net_payout, platform_fee, filed_at, updated_at, settlements(name)`)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("payouts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("settlement_matches")
            .select("payout_estimate")
            .eq("user_id", user.id),
        ]);

        if (claimsRes.data) {
          setClaims(claimsRes.data.map((c: any) => ({
            ...c,
            settlement_name: c.settlements?.name || "Unknown Settlement",
            estimated_payout: Number(c.est_payout) || 0,
            final_payout: c.final_payout ? Number(c.final_payout) : null,
            net_payout: c.net_payout ? Number(c.net_payout) : null,
            platform_fee: c.platform_fee ? Number(c.platform_fee) : null,
          })));
        }
        if (payoutsRes.data) setPayouts(payoutsRes.data);
        if (matchesRes.data) {
          setMatchEstimate(matchesRes.data.reduce((a: number, m: any) => a + (Number(m.payout_estimate) || 0), 0));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const totalRecovered = payouts
    .filter(p => p.status === "paid")
    .reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const pendingPayouts = claims
    .filter(c => c.status === "approved")
    .reduce((a, c) => a + (Number(c.net_payout) || Number(c.est_payout) || 0), 0);
  const approvedTotal = claims
    .filter(c => c.status === "approved" || c.status === "paid")
    .reduce((a, c) => a + (Number(c.net_payout) || Number(c.est_payout) || 0), 0);

  return (
    <div>
      <PageHeader title="Compensation Wallet" subtitle="Track your claims and payouts" />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={Wallet} label="Total Recovered" value={`$${totalRecovered.toLocaleString()}`} variant="teal" />
        <StatCard icon={Clock} label="Pending Payouts" value={`$${pendingPayouts.toLocaleString()}`} />
        <StatCard icon={CheckCircle} label="Approved Value" value={`$${approvedTotal.toLocaleString()}`} variant="teal" />
        <StatCard icon={Scale} label="Estimated Eligible" value={`$${matchEstimate.toLocaleString()}`} />
      </div>

      {/* Premium Auto-Filing Upsell */}
      {!isPremium && (
        <div className="mb-6 glass-card-glow p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Auto-file all eligible claims</p>
              <p className="text-xs text-muted-foreground">Premium members get automatic filing — 15% fee only if paid</p>
            </div>
          </div>
          <Button asChild size="sm" className="rounded-xl bg-primary text-primary-foreground shrink-0">
            <Link to="/pricing">Upgrade</Link>
          </Button>
        </div>
      )}

      {/* Claim Tracker */}
      {!loading && (
        <>
          <h2 className="mb-4 text-lg font-semibold">Claim Tracker</h2>
          <div className="space-y-3 mb-8">
            {claims.length === 0 ? (
              <div className="glass-card p-6 text-center text-muted-foreground">No claims filed yet</div>
            ) : (
              claims.map((claim) => {
                const currentIndex = statusSteps.indexOf(claim.status as any);
                const displayPayout = claim.net_payout || claim.estimated_payout || 0;
                return (
                  <Link key={claim.id} to={`/claims/${claim.id}`} className="glass-card p-6 block hover:border-primary/25 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{claim.settlement_name}</h3>
                        <p className="text-xs text-muted-foreground">Filed: {claim.filed_at ? new Date(claim.filed_at).toLocaleDateString() : "—"} · Updated: {new Date(claim.updated_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <StatusPill variant={claim.status as ClaimStatus} />
                        <p className="mt-1 text-sm font-semibold text-primary">${displayPayout.toLocaleString()}</p>
                        {claim.platform_fee && (
                          <p className="text-[10px] text-muted-foreground">Fee: ${claim.platform_fee.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {statusSteps.map((step, i) => {
                        const isComplete = i <= currentIndex;
                        const isCurrent = i === currentIndex;
                        return (
                          <div key={step} className="flex flex-1 items-center">
                            <div className="flex flex-col items-center flex-1">
                              <div className={`h-2.5 w-2.5 rounded-full ${isComplete ? "bg-primary" : "bg-muted"} ${isCurrent ? "ring-2 ring-primary/30" : ""}`} />
                              <span className={`mt-1 text-[10px] ${isComplete ? "text-primary" : "text-muted-foreground"}`}>
                                {step === "under_review" ? "Review" : step.charAt(0).toUpperCase() + step.slice(1)}
                              </span>
                            </div>
                            {i < statusSteps.length - 1 && (
                              <div className={`h-0.5 flex-1 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Payout Timeline */}
      <h2 className="mb-4 text-lg font-semibold">Payout Timeline</h2>
      <div className="glass-card p-6 mb-8">
        <div className="space-y-4">
          {payouts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No payouts yet</p>
          ) : (
            payouts.map((payout) => {
              const claim = claims.find(c => c.id === payout.claim_id);
              return (
                <div key={payout.id} className="flex items-center gap-4">
                  <div className={`h-3 w-3 rounded-full shrink-0 ${
                    payout.status === "paid" ? "bg-success" : payout.status === "processing" ? "bg-primary" : "bg-muted"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{claim?.settlement_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(payout.paid_at || Date.now()).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-semibold text-primary">${Number(payout.amount).toLocaleString()}</p>
                     <div className="flex flex-col gap-1 items-end mt-1">
                       <span className="text-xs bg-muted/50 px-2 py-0.5 rounded capitalize">{payout.status}</span>
                       {payout.stripe_ref && (
                         <span className="text-[10px] text-muted-foreground font-mono">{payout.stripe_ref}</span>
                       )}
                     </div>
                   </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payment Method */}
      <div className="glass-card border-dashed p-6 text-center">
        <CreditCard className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="font-semibold mb-1">Payment Method</h3>
        <p className="text-sm text-muted-foreground">Direct deposit and payment setup coming soon</p>
      </div>
    </div>
  );
};

export default Claims;
