import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicSettlement } from "@/lib/settlements/types";
import {
  type DeadlineState,
  daysLeftLabel,
  deadlineState,
  payoutLabel,
  settlementPath,
} from "@/lib/settlements/format";

export function DeadlineChip({ state, className }: { state: DeadlineState; className?: string }) {
  if (state.kind === "closed") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
        <CircleSlash className="h-3.5 w-3.5" aria-hidden />
        Closed{state.date ? ` ${state.date}` : ""}
      </span>
    );
  }
  if (state.kind === "unknown") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Deadline not listed
      </span>
    );
  }
  const tone =
    state.daysLeft <= 7 ? "text-critical" : state.daysLeft <= 30 ? "text-warning" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", tone, className)}>
      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
      Closes {state.date} · {daysLeftLabel(state.daysLeft)}
    </span>
  );
}

export function SettlementCard({ settlement }: { settlement: PublicSettlement }) {
  const state = deadlineState(settlement);
  const payout = payoutLabel(settlement);
  return (
    <Link
      to={settlementPath(settlement)}
      className="glass-card group flex h-full flex-col p-5 transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{settlement.company}</p>
      <h3 className="mt-1 text-base font-semibold leading-snug group-hover:text-primary">{settlement.name}</h3>
      <p className="mt-3 text-lg font-bold text-primary">
        {payout ?? <span className="text-sm font-medium text-muted-foreground">Payout not listed</span>}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <DeadlineChip state={state} />
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
      </div>
    </Link>
  );
}

export function SettlementGrid({ settlements, columns = 3 }: { settlements: PublicSettlement[]; columns?: 2 | 3 }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
      {settlements.map((s) => (
        <li key={s.id}>
          <SettlementCard settlement={s} />
        </li>
      ))}
    </ul>
  );
}
