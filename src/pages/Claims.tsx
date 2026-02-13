import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { mockClaims } from "@/data/mockData";
import { Wallet, Clock, CheckCircle, DollarSign, CreditCard } from "lucide-react";
import type { ClaimStatus } from "@/types";

const statusSteps: ClaimStatus[] = ["submitted", "under_review", "approved", "paid"];

const Claims = () => {
  const totalRecovered = mockClaims.filter(c => c.status === "paid").reduce((a, c) => a + c.estimated_payout, 0);
  const pendingPayouts = mockClaims.filter(c => c.status === "approved" || c.status === "under_review").reduce((a, c) => a + c.estimated_payout, 0);
  const approvedCount = mockClaims.filter(c => c.status === "approved" || c.status === "paid").length;
  const totalEstimated = mockClaims.reduce((a, c) => a + c.estimated_payout, 0);

  return (
    <div>
      <PageHeader title="Compensation Wallet" subtitle="Track your claims and payouts" />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={Wallet} label="Total Recovered" value={`$${totalRecovered}`} variant="teal" />
        <StatCard icon={Clock} label="Pending Payouts" value={`$${pendingPayouts}`} />
        <StatCard icon={CheckCircle} label="Approved" value={approvedCount} />
        <StatCard icon={DollarSign} label="Estimated Eligible" value={`$${totalEstimated}`} variant="teal" />
      </div>

      {/* Claim Tracker */}
      <h2 className="mb-4 text-lg font-semibold">Claim Tracker</h2>
      <div className="space-y-3 mb-8">
        {mockClaims.map((claim) => {
          const currentIndex = statusSteps.indexOf(claim.status as any);
          return (
            <div key={claim.id} className="rounded-lg border bg-card p-5">
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
                        <div className={`h-2.5 w-2.5 rounded-full ${isComplete ? "bg-primary" : "bg-secondary"} ${isCurrent ? "ring-2 ring-primary/30" : ""}`} />
                        <span className={`mt-1 text-[10px] ${isComplete ? "text-primary" : "text-muted-foreground"}`}>
                          {step === "under_review" ? "Review" : step.charAt(0).toUpperCase() + step.slice(1)}
                        </span>
                      </div>
                      {i < statusSteps.length - 1 && (
                        <div className={`h-0.5 flex-1 ${i < currentIndex ? "bg-primary" : "bg-secondary"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Method */}
      <div className="rounded-lg border border-dashed bg-card p-6 text-center">
        <CreditCard className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="font-semibold mb-1">Payment Method</h3>
        <p className="text-sm text-muted-foreground">Direct deposit and payment setup coming soon</p>
      </div>
    </div>
  );
};

export default Claims;
