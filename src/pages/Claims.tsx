import { Link } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DeadlineChip } from "@/components/public/SettlementCard";
import { type TrackedClaim, claimStatusLabel, useAccountOverview, useMarkClaimFiled } from "@/lib/account";
import { claimLink, deadlineState, formatDate, settlementPath } from "@/lib/settlements/format";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const toneClass = {
  done: "bg-primary/10 text-primary",
  todo: "bg-warning/10 text-warning",
  info: "bg-muted text-muted-foreground",
  bad: "bg-destructive/10 text-destructive",
};

/** "My claims": the person's own record of what they have filed. */
const Claims = () => {
  const { data, isLoading, isError, refetch } = useAccountOverview();
  const markFiled = useMarkClaimFiled();
  const claims = data?.claims ?? [];
  const matches = data?.matches ?? [];

  const finish = (claim: TrackedClaim) => {
    const match = matches.find((m) => m.settlement.id === claim.settlementId);
    if (!match) return;
    markFiled.mutate(match, {
      onSuccess: () => toast({ title: "Marked as filed" }),
      onError: (e) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My claims" subtitle="Your own record of the claims you've filed" />

      {isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="glass-card p-8 text-center">
          <p className="font-medium">We couldn't load your claims.</p>
          <Button onClick={() => refetch()} className="mt-4 rounded-xl">
            Try again
          </Button>
        </div>
      ) : claims.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <h2 className="text-lg font-semibold">Nothing tracked yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            After you file a claim on a settlement's official site, mark it as filed from My matches and it will appear
            here.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/settlements">Go to My matches</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-6 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            This list is for your own reference. BreachPay doesn't file or process claims, and can't see their status:
            the settlement administrator will contact you directly. Keep the confirmation number from the claim form.
          </p>
          <ul className="space-y-3">
            {claims.map((claim) => {
              const s = claim.settlement;
              const status = claimStatusLabel(claim.status);
              const link = s ? claimLink(s) : null;
              const canFinish =
                claim.status === "draft" && !!s && deadlineState(s).kind !== "closed" &&
                matches.some((m) => m.settlement.id === claim.settlementId);
              return (
                <li key={claim.id} className="glass-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {s?.company ?? "Settlement"}
                      </p>
                      <h2 className="mt-1 font-semibold leading-snug">
                        {s ? (
                          <Link to={settlementPath(s)} className="hover:text-primary hover:underline">
                            {s.name}
                          </Link>
                        ) : (
                          "This settlement is no longer listed"
                        )}
                      </h2>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", toneClass[status.tone])}>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    {claim.status !== "draft" && (
                      <span>
                        Marked as filed{claim.filedAt && formatDate(claim.filedAt) ? ` on ${formatDate(claim.filedAt)}` : ""}
                      </span>
                    )}
                    {s && <DeadlineChip state={deadlineState(s)} className="text-sm" />}
                  </div>

                  {(link || canFinish) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      {link && (
                        <Button asChild size="sm" variant="outline" className="rounded-xl">
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            {link.official ? "Official claim site" : "Claim link"}
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                          </a>
                        </Button>
                      )}
                      {canFinish && (
                        <Button size="sm" className="rounded-xl" disabled={markFiled.isPending} onClick={() => finish(claim)}>
                          I've filed this
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default Claims;
