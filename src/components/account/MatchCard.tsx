import { Link } from "react-router-dom";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeadlineChip } from "@/components/public/SettlementCard";
import { type AccountMatch, type TrackedClaim, claimStatusLabel } from "@/lib/account";
import { claimLink, deadlineState, payoutLabel, settlementPath } from "@/lib/settlements/format";

interface Props {
  match: AccountMatch;
  claim?: TrackedClaim;
  onMarkFiled?: (match: AccountMatch) => void;
  saving?: boolean;
}

/** Strips the internal prefix from a stored reason, leaving the breach it relates to. */
export function relatedBreach(reason: string | null): string | null {
  if (!reason) return null;
  const m = /^HIBP breach match:\s*(.+)$/i.exec(reason);
  return m ? m[1] : null;
}

export function MatchCard({ match, claim, onMarkFiled, saving }: Props) {
  const s = match.settlement;
  const state = deadlineState(s);
  const payout = payoutLabel(s);
  const link = claimLink(s);
  const breach = relatedBreach(match.reason);
  const filed = !!claim && claim.status !== "draft";
  const closed = state.kind === "closed";

  return (
    <article className="glass-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.company}</p>
          <h3 className="mt-1 font-semibold leading-snug">
            <Link to={settlementPath(s)} className="hover:text-primary hover:underline">
              {s.name}
            </Link>
          </h3>
        </div>
        {filed && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Check className="h-3 w-3" aria-hidden /> {claimStatusLabel(claim!.status).label}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span>
          <span className="text-muted-foreground">Listed payout: </span>
          <span className="font-semibold">{payout ?? "not listed"}</span>
        </span>
        <DeadlineChip state={state} className="text-sm" />
      </div>

      {breach && (
        <p className="mt-3 text-xs text-muted-foreground">
          Shown because your breach check found: <span className="text-foreground">{breach}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link to={settlementPath(s)}>Details</Link>
        </Button>
        {!closed && link && (
          <Button asChild size="sm" className="rounded-xl">
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.official ? "File on the official site" : "Open the claim link"}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        )}
        {!closed && !filed && onMarkFiled && (
          <Button size="sm" variant="ghost" className="rounded-xl" disabled={saving} onClick={() => onMarkFiled(match)}>
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            I've filed this
          </Button>
        )}
      </div>
      {!closed && link && (
        <p className="mt-2 text-xs text-muted-foreground">
          Opens {link.host}
          {link.official ? "" : ". We haven't confirmed this as the administrator's official site"}.
        </p>
      )}
    </article>
  );
}
