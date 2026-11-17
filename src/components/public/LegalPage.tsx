import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/public/PublicLayout";
import type { PageMeta } from "@/lib/settlements/content";
import { SUPPORT_EMAIL } from "@/lib/site";
import { useSeo } from "@/lib/useSeo";

export function LegalPage({ meta, title, updated, children }: { meta: PageMeta; title: string; updated: string; children: ReactNode }) {
  useSeo(meta);
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-8">{children}</div>
        <section className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            {SUPPORT_EMAIL ? (
              <>
                Questions about this page can be sent to{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </>
            ) : (
              <>
                See the <Link to="/help" className="text-primary hover:underline">Help page</Link> for common questions.
              </>
            )}
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
