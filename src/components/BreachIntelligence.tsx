import { useState } from "react";
import { useRecentVerifiedBreaches, useActiveSettlements } from "@/hooks/useBreachCatalog";
import { BreachDetailModal } from "@/components/BreachDetailModal";
import type { BreachCatalogEntry } from "@/hooks/useBreachCatalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Scale, Calendar, DollarSign, ArrowRight, Eye } from "lucide-react";
import { differenceInDays, format } from "date-fns";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};

export function BreachIntelligence() {
  const { data: recentBreaches, isLoading: loadingBreaches } = useRecentVerifiedBreaches(6);
  const { data: activeSettlements, isLoading: loadingSettlements } = useActiveSettlements();
  const [selectedBreach, setSelectedBreach] = useState<BreachCatalogEntry | null>(null);

  // Check if all data is empty (no breaches and no settlements from catalog)
  const hasNoData = !loadingBreaches && !loadingSettlements && 
    (!recentBreaches?.length) && (!activeSettlements?.length);

  return (
    <div className="space-y-6">
      {/* Active Settlements Widget */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Active Settlements</h3>
          </div>
        </div>
        {loadingSettlements ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        ) : !activeSettlements?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">No active settlements at this time.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {activeSettlements.slice(0, 4).map((s) => {
              const daysLeft = s.claim_deadline ? differenceInDays(new Date(s.claim_deadline), new Date()) : null;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedBreach(s)}
                  className="glass-card p-4 text-left transition-all hover:border-primary/20 cursor-pointer w-full"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-[10px] shrink-0">
                      {s.company.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.company}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.settlement_name || s.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold gradient-emerald-text">
                      ${(s.estimated_payout_min || 0).toLocaleString()} – ${(s.estimated_payout_max || 0).toLocaleString()}
                    </p>
                    {daysLeft != null && (
                      <Badge variant="outline" className={`text-[10px] ${daysLeft <= 30 ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-primary/15 text-primary border-primary/30"}`}>
                        {daysLeft}d left
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Verified Breaches */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Recent Breach Intelligence</h3>
          </div>
        </div>
        {loadingBreaches ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        ) : !recentBreaches?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">No breach data available.</p>
        ) : (
          <div className="space-y-2">
            {recentBreaches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBreach(b)}
                className="glass-card p-4 flex items-center justify-between w-full text-left transition-all hover:border-primary/20 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {b.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.company}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`capitalize text-[10px] ${SEVERITY_COLORS[b.severity] || ""}`}>
                    {b.severity}
                  </Badge>
                  {b.settlement_available && (
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                  )}
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BreachDetailModal
        breach={selectedBreach}
        open={!!selectedBreach}
        onOpenChange={(open) => !open && setSelectedBreach(null)}
      />
    </div>
  );
}
