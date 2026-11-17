import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, FileText, Loader2, Scale, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/account/MatchCard";
import { type AccountMatch, useAccountOverview, useMarkClaimFiled } from "@/lib/account";
import { DIRECTORY_PATH, isOpen } from "@/lib/settlements/format";
import { toast } from "@/hooks/use-toast";

function Tile({ icon: Icon, label, value, to, action }: { icon: typeof Search; label: string; value: number; to: string; action: string }) {
  return (
    <Link to={to} className="glass-card group block p-5 transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
        {action} <ArrowRight className="h-3 w-3" aria-hidden />
      </p>
    </Link>
  );
}

const Dashboard = () => {
  const { data, isLoading, isError, refetch } = useAccountOverview();
  const markFiled = useMarkClaimFiled();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Dashboard" subtitle="Your breach check, matches and claims" />
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Dashboard" subtitle="Your breach check, matches and claims" />
        <div className="glass-card p-8 text-center">
          <p className="font-medium">We couldn't load your dashboard.</p>
          <Button onClick={() => refetch()} className="mt-4 rounded-xl">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const { lastCheck, matches, claims, alerts } = data;
  const filedIds = new Set(claims.filter((c) => c.status !== "draft").map((c) => c.settlementId));
  const openMatches = matches.filter((m) => isOpen(m.settlement));
  const toDo = openMatches.filter((m) => !filedIds.has(m.settlement.id));

  const onMarkFiled = (match: AccountMatch) =>
    markFiled.mutate(match, {
      onSuccess: () => toast({ title: "Marked as filed", description: "It's now in My claims." }),
      onError: (e) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
    });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Dashboard" subtitle="Your breach check, matches and claims" />

      {!lastCheck ? (
        <section className="glass-card-glow p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Search className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <h2 className="text-xl font-bold">Start with a breach check</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            See which known data breaches include your email address, and which listed settlements may be related.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-xl">
              <Link to="/scan">Run a breach check</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to={DIRECTORY_PATH}>Browse all settlements</Link>
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          <section aria-label="Summary">
            <div className="grid gap-4 sm:grid-cols-3">
              <Tile icon={ShieldAlert} label="Breaches with your email" value={lastCheck.breaches} to="/scan" action="See results" />
              <Tile icon={Scale} label="Matches open for claims" value={openMatches.length} to="/settlements" action="View matches" />
              <Tile icon={FileText} label="Claims marked as filed" value={filedIds.size} to="/claims" action="View claims" />
            </div>
            {lastCheck.completedAt && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last breach check {formatDistanceToNow(new Date(lastCheck.completedAt), { addSuffix: true })}.{" "}
                <Link to="/scan" className="text-primary hover:underline">
                  Run it again
                </Link>
              </p>
            )}
          </section>

          <section aria-labelledby="todo-heading">
            <h2 id="todo-heading" className="mb-1 text-lg font-semibold">
              Matches to look at
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">Open settlements you haven't marked as filed, soonest deadline first.</p>
            {toDo.length > 0 ? (
              <div className="space-y-3">
                {toDo.slice(0, 3).map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    onMarkFiled={onMarkFiled}
                    saving={markFiled.isPending && markFiled.variables?.id === m.id}
                  />
                ))}
                {toDo.length > 3 && (
                  <Button asChild variant="ghost" className="rounded-xl">
                    <Link to="/settlements">
                      See all {toDo.length} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="glass-card p-6 text-sm text-muted-foreground">
                {openMatches.length > 0
                  ? "You've marked every open match as filed."
                  : "No listed settlement matches your breach check results right now."}{" "}
                <Link to={DIRECTORY_PATH} className="text-primary hover:underline">
                  Browse all settlements
                </Link>
                .
              </div>
            )}
          </section>

          {alerts.length > 0 && (
            <section aria-labelledby="activity-heading">
              <h2 id="activity-heading" className="mb-4 text-lg font-semibold">
                Recent activity
              </h2>
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="glass-card flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        BreachPay is an independent directory, not a law firm. A match is not an eligibility decision.
      </p>
    </div>
  );
};

export default Dashboard;
