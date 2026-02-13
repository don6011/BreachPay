import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { mockSettlements } from "@/data/mockData";
import { Scale, DollarSign, Clock, ArrowRight } from "lucide-react";
import type { SettlementStatus } from "@/types";
import { Link } from "react-router-dom";

type FilterTab = "all" | SettlementStatus | "filed";

const tabs: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
];

const Settlements = () => {
  const [filter, setFilter] = useState<FilterTab>("all");
  const filtered = filter === "all" ? mockSettlements : mockSettlements.filter(s => s.status === filter);
  const openSettlements = mockSettlements.filter(s => s.status === "open");
  const totalMin = openSettlements.reduce((a, s) => a + s.payout_min, 0);
  const totalMax = openSettlements.reduce((a, s) => a + s.payout_max, 0);

  return (
    <div>
      <PageHeader title="Settlements" subtitle="Your eligible settlement matches" />

      {/* Summary */}
      <div className="mb-6 rounded-2xl border border-primary/20 bg-card p-6 shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)]">
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">You qualify for <span className="font-semibold text-foreground">{openSettlements.length} settlements</span></p>
            <p className="text-lg font-bold text-primary">${totalMin.toLocaleString()} – ${totalMax.toLocaleString()} estimated</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${filter === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settlement Cards */}
      <div className="space-y-3">
        {filtered.map((settlement) => {
          const daysLeft = Math.max(0, Math.ceil((new Date(settlement.deadline).getTime() - Date.now()) / 86400000));
          return (
            <div key={settlement.id} className="rounded-2xl border bg-card p-6 transition-all hover:border-primary/20">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{settlement.name}</h3>
                  <p className="text-xs text-muted-foreground">{settlement.company} · {settlement.breach_year}</p>
                </div>
                <StatusPill variant={settlement.status} />
              </div>
              <p className="text-sm text-muted-foreground mb-3">{settlement.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>${settlement.payout_min} – ${settlement.payout_max.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{daysLeft} days left</span>
                </div>
                {settlement.matched_via && (
                  <span className="text-xs text-primary">Matched via: {settlement.matched_via}</span>
                )}
              </div>
              <div className="mt-3">
                {settlement.status === "open" ? (
                  <Button size="sm" asChild className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_16px_hsl(172_89%_52%/0.3)] transition-all duration-300">
                    <Link to="/claims">File Claim <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                ) : settlement.status === "pending" ? (
                  <Button size="sm" variant="outline" asChild className="rounded-xl"><Link to="/claims">Track Claim</Link></Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Settlements;
