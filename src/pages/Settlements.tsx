import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/account/MatchCard";
import { type AccountMatch, useAccountOverview, useMarkClaimFiled } from "@/lib/account";
import { DIRECTORY_PATH, isOpen } from "@/lib/settlements/format";
import { toast } from "@/hooks/use-toast";

/** "My matches": listed settlements that may relate to the account's breach check results. */
const Settlements = () => {
  const { data, isLoading, isError, refetch } = useAccountOverview();
  const markFiled = useMarkClaimFiled();

  const matches = data?.matches ?? [];
  const claims = data?.claims ?? [];
  const claimFor = (m: AccountMatch) => claims.find((c) => c.settlementId === m.settlement.id);
  const open = matches.filter((m) => isOpen(m.settlement));
  const closed = matches.filter((m) => !isOpen(m.settlement));

  const onMarkFiled = (match: AccountMatch) =>
    markFiled.mutate(match, {
      onSuccess: () => toast({ title: "Marked as filed", description: "It's now in My claims." }),
      onError: (e) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
    });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My matches" subtitle="Listed settlements that may relate to breaches found for your email" />

      {isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="glass-card p-8 text-center">
          <p className="font-medium">We couldn't load your matches.</p>
          <Button onClick={() => refetch()} className="mt-4 rounded-xl">
            Try again
          </Button>
        </div>
      ) : !data?.lastCheck ? (
        <div className="glass-card p-8 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">Run a breach check first</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Matches come from your breach check. It looks up your email address in the Have I Been Pwned database.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/scan">Go to breach check</Link>
          </Button>
        </div>
      ) : matches.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <h2 className="text-lg font-semibold">No matches right now</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            None of the settlements we list involve a company from your breach check results. You may still be covered
            by a settlement, so it's worth browsing what's open.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to={DIRECTORY_PATH}>Browse all settlements</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            A match means a listed settlement involves a company from your results. It doesn't mean you're eligible:
            read the notice on the official site, and file there if you're covered. Filing is free.
          </p>

          {open.length > 0 && (
            <section aria-labelledby="open-matches">
              <h2 id="open-matches" className="mb-3 text-lg font-semibold">
                Open for claims ({open.length})
              </h2>
              <div className="space-y-3">
                {open.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    claim={claimFor(m)}
                    onMarkFiled={onMarkFiled}
                    saving={markFiled.isPending && markFiled.variables?.id === m.id}
                  />
                ))}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section aria-labelledby="closed-matches">
              <h2 id="closed-matches" className="mb-3 text-lg font-semibold">
                Closed ({closed.length})
              </h2>
              <div className="space-y-3">
                {closed.map((m) => (
                  <MatchCard key={m.id} match={m} claim={claimFor(m)} />
                ))}
              </div>
            </section>
          )}

          <p className="text-sm text-muted-foreground">
            Looking for something else?{" "}
            <Link to={DIRECTORY_PATH} className="text-primary hover:underline">
              Browse all settlements
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
};

export default Settlements;
