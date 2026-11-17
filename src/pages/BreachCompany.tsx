import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoadError, PageSpinner, PublicLayout } from "@/components/public/PublicLayout";
import { SettlementGrid } from "@/components/public/SettlementCard";
import { companyMeta } from "@/lib/settlements/content";
import { useCompanySettlements } from "@/lib/settlements/data";
import { DIRECTORY_PATH, isOpen } from "@/lib/settlements/format";
import { useSeo } from "@/lib/useSeo";

/** Turns "acme-bank" into "Acme Bank" for the brief moment before data arrives. */
function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const BreachCompany = () => {
  const { company: slug = "" } = useParams<{ company: string }>();
  const { data, isLoading, isError, refetch } = useCompanySettlements(slug);
  const list = data ?? [];
  const company = list[0]?.company ?? titleFromSlug(slug);
  const open = list.filter((s) => isOpen(s));
  const closed = list.filter((s) => !isOpen(s));
  useSeo(isLoading || isError ? null : companyMeta(company, list));

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2" aria-hidden>/</span>
          <Link to={DIRECTORY_PATH} className="hover:text-foreground">Data breach settlements</Link>
          <span className="mx-2" aria-hidden>/</span>
          <span className="text-foreground">{company}</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{company} data breach settlements</h1>

        {isLoading ? (
          <PageSpinner />
        ) : isError ? (
          <LoadError onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <div className="mt-8 max-w-xl">
            <p className="text-muted-foreground">
              We don't have any settlements listed for {company}. That doesn't mean there isn't one: we only publish
              settlements after they have been reviewed.
            </p>
            <Button asChild className="mt-6 rounded-xl">
              <Link to={DIRECTORY_PATH}>Browse open settlements</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {open.length > 0
                ? `${open.length} settlement${open.length === 1 ? "" : "s"} involving ${company} ${open.length === 1 ? "is" : "are"} open for claims. Filing is free and done on the official settlement site.`
                : `No ${company} settlement on record is open for claims right now. Closed claim periods are listed below for reference.`}
            </p>

            {open.length > 0 && (
              <section className="mt-8" aria-labelledby="open-heading">
                <h2 id="open-heading" className="mb-4 text-xl font-semibold">Open for claims</h2>
                <SettlementGrid settlements={open} />
              </section>
            )}

            {closed.length > 0 && (
              <section className="mt-10" aria-labelledby="closed-heading">
                <h2 id="closed-heading" className="mb-4 text-xl font-semibold">Closed</h2>
                <SettlementGrid settlements={closed} />
              </section>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
};

export default BreachCompany;
