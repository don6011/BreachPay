import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, ExternalLink, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCalendar } from "@/components/public/AddToCalendar";
import { EmailSignup } from "@/components/public/EmailSignup";
import { FaqList } from "@/components/public/FaqList";
import { LoadError, PageSpinner, PublicLayout } from "@/components/public/PublicLayout";
import { DeadlineChip, SettlementGrid } from "@/components/public/SettlementCard";
import { settlementFaqs, settlementMeta } from "@/lib/settlements/content";
import { useSettlementPage } from "@/lib/settlements/data";
import {
  DIRECTORY_PATH,
  categoryLabel,
  claimLink,
  companyPath,
  daysLeftLabel,
  deadlineState,
  displayName,
  formatDate,
  payoutLabel,
  settlementSlug,
  sourceLinks,
  verificationInfo,
} from "@/lib/settlements/format";
import type { PublicSettlement } from "@/lib/settlements/types";
import { useSeo } from "@/lib/useSeo";

const NOT_FOUND_META = {
  title: "Settlement not found | BreachPay",
  description: "This settlement page doesn't exist or is no longer listed.",
  canonical: "",
  jsonLd: [],
  noindex: true,
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 sm:flex-row sm:gap-6">
      <dt className="shrink-0 text-sm text-muted-foreground sm:w-44">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function SettlementArticle({
  settlement: s,
  related,
}: {
  settlement: PublicSettlement;
  related: PublicSettlement[];
}) {
  const state = deadlineState(s);
  const payout = payoutLabel(s);
  const link = claimLink(s);
  const sources = sourceLinks(s);
  const verification = verificationInfo(s.verification_level);
  const lastChecked = formatDate(s.last_verified_at) ?? formatDate(s.updated_at);
  const category = categoryLabel(s.category);
  const closed = state.kind === "closed";

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2" aria-hidden>/</span>
        <Link to={DIRECTORY_PATH} className="hover:text-foreground">Data breach settlements</Link>
        <span className="mx-2" aria-hidden>/</span>
        <Link to={companyPath(s.company)} className="hover:text-foreground">{s.company}</Link>
      </nav>

      <header className="mt-5">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{displayName(s)}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <DeadlineChip state={state} className="text-sm" />
          {category && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{category}</span>}
        </div>
      </header>

      {/* Key numbers and the one action that matters */}
      <section className="glass-card-glow mt-8 p-6 sm:p-8" aria-label="Summary">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Listed payout</p>
            <p className="mt-1 text-2xl font-bold text-primary">
              {payout ?? <span className="text-base font-medium text-muted-foreground">Not listed</span>}
            </p>
            {payout && <p className="mt-1 text-xs text-muted-foreground">Per valid claim, as stated in the notice. Actual payments can be lower.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claim deadline</p>
            <p className="mt-1 text-2xl font-bold">
              {state.kind === "unknown" ? (
                <span className="text-base font-medium text-muted-foreground">Not listed</span>
              ) : (
                state.date ?? "Closed"
              )}
            </p>
            {state.kind === "open" && <p className="mt-1 text-xs text-muted-foreground">{daysLeftLabel(state.daysLeft)}</p>}
            {closed && <p className="mt-1 text-xs text-muted-foreground">The claim period has ended.</p>}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          {closed ? (
            <p className="flex items-start gap-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                This settlement is no longer accepting claims.{" "}
                <Link to={DIRECTORY_PATH} className="font-medium text-primary hover:underline">
                  See settlements that are still open
                </Link>
                .
              </span>
            </p>
          ) : link ? (
            <div className="space-y-4">
              <div>
                <Button asChild size="lg" className="h-auto min-h-12 w-full whitespace-normal rounded-xl py-3 text-base sm:w-auto">
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label} <ExternalLink className="ml-2 h-4 w-4 shrink-0" aria-hidden />
                  </a>
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Opens <span className="font-medium text-foreground">{link.host}</span>
                  {link.official
                    ? ". Filing is free."
                    : ". We haven't confirmed this as the administrator's official site, so check the address before entering personal details. Filing is free."}
                </p>
              </div>
              <AddToCalendar settlement={s} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                We don't have a claim link on record for this settlement yet. Look for the administrator's official
                site named in the settlement notice.
              </p>
              <AddToCalendar settlement={s} />
            </div>
          )}
        </div>
      </section>

      {state.kind === "open" && state.daysLeft >= 1 && (
        <EmailSignup
          kind="deadline"
          settlementId={s.id}
          className="mt-6"
          title="Get a reminder before it closes"
          description={`We'll email you a week before and the day before the ${state.date} deadline.`}
        />
      )}

      <section className="mt-10" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-xl font-semibold">Settlement details</h2>
        <dl className="glass-card mt-4 px-5 py-1">
          <Fact label="Company">
            <Link to={companyPath(s.company)} className="text-primary hover:underline">{s.company}</Link>
          </Fact>
          {s.breach_year && <Fact label="Year of the breach">{s.breach_year}</Fact>}
          {s.case_number && <Fact label="Case number">{s.case_number}</Fact>}
          {s.jurisdiction && <Fact label="Court">{s.jurisdiction}</Fact>}
          {s.administrator_name && <Fact label="Settlement administrator">{s.administrator_name}</Fact>}
          {formatDate(s.final_approval_date) && <Fact label="Final approval hearing">{formatDate(s.final_approval_date)}</Fact>}
          {lastChecked && <Fact label="Listing last updated">{lastChecked}</Fact>}
        </dl>
      </section>

      {s.description && (
        <section className="mt-10" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-xl font-semibold">About this settlement</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{s.description}</p>
        </section>
      )}

      <section className="mt-10" aria-labelledby="eligibility-heading">
        <h2 id="eligibility-heading" className="text-xl font-semibold">Who can file</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
          {s.eligibility_summary ??
            "We don't have the class definition on record. The official settlement notice says exactly who is covered."}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          The settlement administrator decides who is eligible. If you received a notice by mail or email, keep it:
          the claim form usually asks for the ID printed on it.
        </p>
      </section>

      {!closed && (
        <section className="mt-10" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-xl font-semibold">How to file</h2>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {[
              link
                ? link.official
                  ? `Open the claim site (${link.host}) and read the notice to confirm you're covered.`
                  : `Open the claim link (${link.host}). Check that it is the administrator's official site, then read the notice to confirm you're covered.`
                : "Find the administrator's official site named in the settlement notice and confirm you're covered.",
              "Fill in the claim form. Have your notice ID ready if you were sent one, and any proof the form asks for.",
              state.kind === "open"
                ? `Submit before ${state.date}. Late claims are generally not accepted.`
                : "Submit before the deadline shown on the official site. Late claims are generally not accepted.",
              "Save the confirmation number or email. Payments are sent by the administrator after final court approval.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-10" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="text-xl font-semibold">Sources and how we checked this</h2>
        <div className="glass-card mt-4 p-5">
          <p className="flex items-start gap-3 text-sm">
            {s.verification_level && s.verification_level !== "unverified" ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            )}
            <span>
              <span className="font-semibold">{verification.label}.</span>{" "}
              <span className="text-muted-foreground">{verification.detail}</span>
            </span>
          </p>
          {sources.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              {sources.map((src) => (
                <li key={src.url}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    {src.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <span className="ml-2 text-muted-foreground">{src.host}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
              No source links are on record for this listing.
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            BreachPay is an independent directory. We are not the settlement administrator, not a law firm and not
            affiliated with {s.company}. If something here looks wrong, trust the official notice.
          </p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-xl font-semibold">Questions about this settlement</h2>
        <div className="mt-4">
          <FaqList faqs={settlementFaqs(s)} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-semibold">Related settlements</h2>
          <div className="mt-4">
            <SettlementGrid settlements={related} columns={2} />
          </div>
        </section>
      )}

      <aside className="glass-card mt-12 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Were you in other breaches?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your email against known breaches with a free account.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 rounded-xl">
          <Link to="/signup">
            Free breach check <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </aside>
    </article>
  );
}

const SettlementPublic = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, isLoading, isError, refetch } = useSettlementPage(slug);
  const settlement = data?.settlement ?? null;
  useSeo(settlement ? settlementMeta(settlement) : !isLoading && !isError ? NOT_FOUND_META : null);

  // Send old or edited URLs to the current address for this settlement.
  if (settlement && settlementSlug(settlement) !== slug) {
    return <Navigate to={`/settlement/${settlementSlug(settlement)}`} replace />;
  }

  return (
    <PublicLayout>
      {isLoading ? (
        <PageSpinner />
      ) : isError ? (
        <LoadError onRetry={() => refetch()} />
      ) : settlement ? (
        <SettlementArticle settlement={settlement} related={data?.related ?? []} />
      ) : (
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-3xl font-bold">Settlement not found</h1>
          <p className="mt-3 text-muted-foreground">
            This page doesn't exist, or the settlement is no longer listed.
          </p>
          <Button asChild className="mt-6 rounded-xl">
            <Link to={DIRECTORY_PATH}>Browse open settlements</Link>
          </Button>
        </div>
      )}
    </PublicLayout>
  );
};

export default SettlementPublic;
