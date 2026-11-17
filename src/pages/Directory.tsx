import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LoadError, PageSpinner, PublicLayout } from "@/components/public/PublicLayout";
import { SettlementGrid } from "@/components/public/SettlementCard";
import { directoryMeta } from "@/lib/settlements/content";
import { usePublicSettlements } from "@/lib/settlements/data";
import { daysUntil, effectiveDeadline, isOpen, parseDate } from "@/lib/settlements/format";
import type { PublicSettlement } from "@/lib/settlements/types";
import { useSeo } from "@/lib/useSeo";

type Filter = "open" | "soon" | "closed";
type Sort = "deadline" | "payout" | "newest";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "soon", label: "Closing in 30 days" },
  { id: "closed", label: "Closed" },
];

function matches(s: PublicSettlement, q: string) {
  if (!q) return true;
  const hay = `${s.company} ${s.name} ${s.category ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

const Directory = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const filter = (["open", "soon", "closed"].includes(params.get("show") ?? "") ? params.get("show") : "open") as Filter;
  const sort = (["deadline", "payout", "newest"].includes(params.get("sort") ?? "") ? params.get("sort") : "deadline") as Sort;

  const { data, isLoading, isError, refetch } = usePublicSettlements();
  const all = useMemo(() => data ?? [], [data]);
  const open = useMemo(() => all.filter((s) => isOpen(s)), [all]);
  useSeo(directoryMeta(open));

  const update = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const visible = useMemo(() => {
    let list = all.filter((s) => matches(s, q));
    if (filter === "open") list = list.filter((s) => isOpen(s));
    if (filter === "soon")
      list = list.filter((s) => {
        const d = daysUntil(effectiveDeadline(s));
        return isOpen(s) && d !== null && d <= 30;
      });
    if (filter === "closed") {
      list = list
        .filter((s) => !isOpen(s))
        .sort(
          (a, b) =>
            (parseDate(effectiveDeadline(b))?.getTime() ?? 0) - (parseDate(effectiveDeadline(a))?.getTime() ?? 0),
        );
    }
    if (sort === "payout") {
      list = [...list].sort(
        (a, b) => Math.max(b.payout_max ?? 0, b.payout_min ?? 0) - Math.max(a.payout_max ?? 0, a.payout_min ?? 0),
      );
    }
    if (sort === "newest") {
      list = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return list;
  }, [all, q, filter, sort]);

  const counts: Record<Filter, number> = {
    open: open.length,
    soon: open.filter((s) => {
      const d = daysUntil(effectiveDeadline(s));
      return d !== null && d <= 30;
    }).length,
    closed: all.length - open.length,
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2" aria-hidden>/</span>
          <span className="text-foreground">Data breach settlements</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Data breach settlements</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Class action settlements for data breaches and privacy violations. Each listing shows the claim deadline,
          the payout stated in the notice and a link to file. Filing is always free.
        </p>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <label htmlFor="directory-search" className="sr-only">
              Search settlements
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="directory-search"
              type="search"
              value={q}
              onChange={(e) => update("q", e.target.value, "")}
              placeholder="Search by company"
              className="h-11 rounded-xl pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => update("show", f.id, "open")}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    filter === f.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  {!isLoading && <span className="ml-1.5 opacity-70">{counts[f.id]}</span>}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground lg:ml-2">
              Sort
              <select
                value={sort}
                onChange={(e) => update("sort", e.target.value, "deadline")}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="deadline">Deadline</option>
                <option value="payout">Highest listed payout</option>
                <option value="newest">Recently updated</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-8" aria-live="polite">
          {isLoading ? (
            <PageSpinner />
          ) : isError ? (
            <LoadError onRetry={() => refetch()} />
          ) : visible.length > 0 ? (
            <SettlementGrid settlements={visible} />
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="font-medium">
                {q ? `No settlements match “${q}”.` : "No settlements to show here right now."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {q
                  ? "Try the company's full name, or clear the search to see everything that's open."
                  : "We only publish a settlement after it has been reviewed. Check back soon."}
              </p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default Directory;
