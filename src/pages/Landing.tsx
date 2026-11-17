import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, FileSearch, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailSignup } from "@/components/public/EmailSignup";
import { FaqList } from "@/components/public/FaqList";
import { LoadError, PageSpinner, PublicLayout } from "@/components/public/PublicLayout";
import { SettlementGrid } from "@/components/public/SettlementCard";
import { HOME_FAQS, homeMeta } from "@/lib/settlements/content";
import { usePublicSettlements } from "@/lib/settlements/data";
import { DIRECTORY_PATH, daysUntil, effectiveDeadline, isOpen } from "@/lib/settlements/format";
import { useSeo } from "@/lib/useSeo";

const steps = [
  {
    icon: Search,
    title: "Find a settlement",
    body: "Search by company or browse what's open. Each listing shows the claim deadline and the payout stated in the notice.",
  },
  {
    icon: FileSearch,
    title: "Check the official terms",
    body: "We show where each detail came from. Read the class definition on the official site to see if you're covered.",
  },
  {
    icon: ExternalLink,
    title: "File for free",
    body: "You file directly with the settlement administrator. It costs nothing and you don't need a lawyer.",
  },
];

const does = [
  "Lists data breach settlements that are open for claims",
  "Shows the deadline, the listed payout and who can file",
  "Links to the claim site and shows its web address first",
  "Tells you how each listing was checked",
];

const doesNot = [
  "Charge you to find or file a claim",
  "Decide whether you're eligible, or pay settlements",
  "Ask for your Social Security number or bank login",
  "Give legal advice or act as your lawyer",
];

const Landing = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, refetch } = usePublicSettlements();
  useSeo(homeMeta());

  const open = (data ?? []).filter((s) => isOpen(s));
  const closingSoon = open.filter((s) => {
    const d = daysUntil(effectiveDeadline(s));
    return d !== null && d <= 30;
  });

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `${DIRECTORY_PATH}?q=${encodeURIComponent(q)}` : DIRECTORY_PATH);
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(164 100% 45% / 0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Free and independent</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Find data breach settlements you can still claim
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            A directory of open data breach class action settlements, with claim deadlines, listed payouts and links
            to the official claim sites.
          </p>

          <form
            onSubmit={onSearch}
            action={DIRECTORY_PATH}
            method="get"
            role="search"
            className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="home-search" className="sr-only">
              Search settlements by company
            </label>
            <Input
              id="home-search"
              name="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by company, e.g. a bank or phone carrier"
              className="h-12 rounded-xl text-base"
            />
            <Button type="submit" size="lg" className="h-12 rounded-xl px-6">
              <Search className="mr-2 h-4 w-4" aria-hidden /> Search
            </Button>
          </form>

          {open.length > 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{open.length}</span> open settlement
              {open.length === 1 ? "" : "s"} listed
              {closingSoon.length > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-foreground">{closingSoon.length}</span> closing within 30 days
                </>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="closing-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="closing-heading" className="text-2xl font-bold">
              Deadlines coming up
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Open settlements, soonest deadline first.</p>
          </div>
          <Link to={DIRECTORY_PATH} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {open.length > 6 ? `See all ${open.length} open settlements` : "Browse all settlements"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {isLoading ? (
          <PageSpinner />
        ) : isError ? (
          <LoadError onRetry={() => refetch()} />
        ) : open.length > 0 ? (
          <SettlementGrid settlements={open.slice(0, 6)} />
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="font-medium">No open settlements are listed right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We only publish a settlement after it has been reviewed. Check back soon.
            </p>
          </div>
        )}
      </section>

      <section className="border-y border-border bg-card/40" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="how-heading" className="text-2xl font-bold">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="glass-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="text-2xl font-bold">
          What BreachPay does, and what it doesn't
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="glass-card p-6">
            <h3 className="font-semibold">BreachPay</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {does.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-6">
            <h3 className="font-semibold">BreachPay does not</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {doesNot.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Not sure which breaches you were in?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              With a free account you can check your email address against known breaches, using data from Have I
              Been Pwned, and keep track of the settlements you've filed.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 rounded-xl">
            <Link to="/signup">
              Create a free account <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
        <EmailSignup
          kind="weekly"
          title="New settlements and deadlines, once a week"
          description="One short email: new or updated settlements and claim deadlines coming up. Nothing else."
        />
      </div>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold">
          Common questions
        </h2>
        <div className="mt-6">
          <FaqList faqs={HOME_FAQS} />
        </div>
      </section>
    </PublicLayout>
  );
};

export default Landing;
