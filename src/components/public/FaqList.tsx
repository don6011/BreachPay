import type { Faq } from "@/lib/settlements/content";

/** Native disclosure widgets: readable without JavaScript and by search engines. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="space-y-2">
      {faqs.map((f) => (
        <details key={f.q} className="glass-card group px-5 py-4">
          <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-4">
              {f.q}
              <span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
