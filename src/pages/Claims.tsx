import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { mockClaims } from "@/data/mockData";
import { Wallet, Clock, CheckCircle, DollarSign, CreditCard, Crown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { ClaimStatus } from "@/types";

const statusSteps: ClaimStatus[] = ["submitted", "under_review", "approved", "paid"];

const Claims = () => {
  const isPremium = false;
  const totalRecovered = mockClaims.filter(c => c.status === "paid").reduce((a, c) => a + c.estimated_payout, 0);
  const pendingPayouts = mockClaims.filter(c => c.status === "approved" || c.status === "under_review").reduce((a, c) => a + c.estimated_payout, 0);
  const approvedCount = mockClaims.filter(c => c.status === "approved" || c.status === "paid").length;
  const totalEstimated = mockClaims.reduce((a, c) => a + c.estimated_payout, 0);
  const lifetimeEarnings = totalRecovered;

  return (
    <div>
      <PageHeader title="Compensation Wallet" subtitle="Track your claims and payouts" />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={Wallet} label="Total Recovered" value={`$${totalRecovered}`} variant="teal" />
        <StatCard icon={Clock} label="Pending Payouts" value={`$${pendingPayouts}`} />
        <StatCard icon={CheckCircle} label="Approved" value={approvedCount} />
        <StatCard icon={TrendingUp} label="Lifetime Earnings" value={`$${lifetimeEarnings}`} variant="teal" />
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
      <h2 className="mb-4 text-lg font-semibold">Claim Tracker</h2>
      <div className="space-y-3 mb-8">
        {mockClaims.map((claim) => {
          const currentIndex = statusSteps.indexOf(claim.status as any);
          return (
            <div key={claim.id} className="glass-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{claim.settlement_name}</h3>
                  <p className="text-xs text-muted-foreground">Filed: {claim.filed_at} · Updated: {claim.updated_at}</p>
                </div>
                <div className="text-right">
                  <StatusPill variant={claim.status} />
                  <p className="mt-1 text-sm font-semibold text-primary">${claim.estimated_payout}</p>
                </div>
              </div>
              {/* Timeline */}
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
            </div>
          );
        })}
      </div>

      {/* Payout Timeline */}
      <h2 className="mb-4 text-lg font-semibold">Payout Timeline</h2>
      <div className="glass-card p-6 mb-8">
        <div className="space-y-4">
          {mockClaims.map((claim) => (
            <div key={claim.id} className="flex items-center gap-4">
              <div className={`h-3 w-3 rounded-full shrink-0 ${
                claim.status === "paid" ? "bg-success" : claim.status === "approved" ? "bg-primary" : "bg-muted"
              }`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{claim.settlement_name}</p>
                <p className="text-xs text-muted-foreground">{claim.updated_at}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">${claim.estimated_payout}</p>
                <StatusPill variant={claim.status} />
              </div>
            </div>
          ))}
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
