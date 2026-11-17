import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaqList } from "@/components/public/FaqList";
import { PublicLayout } from "@/components/public/PublicLayout";
import type { Faq, PageMeta } from "@/lib/settlements/content";
import { DIRECTORY_PATH, SITE_NAME, SITE_URL } from "@/lib/settlements/format";
import { useSeo } from "@/lib/useSeo";

const withoutAccount = [
  "Browse every listed settlement",
  "See deadlines, listed payouts and who can file",
  "Follow links to the claim sites",
  "Add a claim deadline to your calendar",
];

const withAccount = [
  "Check your email address against known breaches (Have I Been Pwned data)",
  "See listed settlements that match the breaches found",
  "Keep track of the claims you've filed",
  "Come back to your results any time",
];

export const PRICING_FAQS: Faq[] = [
  {
    q: "Is BreachPay really free?",
    a: "Yes. There is no paid plan and nothing on the site asks for payment. Browsing settlements does not require an account.",
  },
  {
    q: "Do you take a cut of my settlement payment?",
    a: "No. You file directly with the settlement administrator, and the administrator pays you directly. BreachPay never handles settlement money.",
  },
  {
    q: "Does it cost anything to file a claim?",
    a: "No. Filing a class action settlement claim is free and you do not need a lawyer. Be wary of any service that charges a fee to file for you.",
  },
  {
    q: "How does the breach check work?",
    a: "When you run a check, your account email address is looked up in the Have I Been Pwned breach database, and the results are saved to your account so you can come back to them.",
  },
];

export const PRICING_META: PageMeta = {
  title: `Pricing: Free | ${SITE_NAME}`,
  description:
    "BreachPay is free. Browse data breach settlements without an account, or create a free account to check your email against known breaches.",
  canonical: `${SITE_URL}/pricing`,
  jsonLd: [
    {
      "@type": "FAQPage",
      mainEntity: PRICING_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

function Column({ title, note, items, children }: { title: string; note: string; items: string[]; children: React.ReactNode }) {
  return (
    <div className="glass-card flex flex-col p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      <ul className="mt-6 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">{children}</div>
    </div>
  );
}

const Pricing = () => {
  useSeo(PRICING_META);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">BreachPay is free</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          There is no paid plan. You never pay BreachPay to find a settlement, and filing a claim with a settlement
          administrator is free too.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Column title="Without an account" note="$0, no sign-up" items={withoutAccount}>
            <Button asChild variant="secondary" className="w-full rounded-xl">
              <Link to={DIRECTORY_PATH}>Browse settlements</Link>
            </Button>
          </Column>
          <Column title="With a free account" note="$0, email and password only" items={withAccount}>
            <Button asChild className="w-full rounded-xl">
              <Link to="/signup">
                Create a free account <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </Column>
        </div>

        <h2 className="mt-16 text-2xl font-bold">Questions about cost</h2>
        <div className="mt-6">
          <FaqList faqs={PRICING_FAQS} />
        </div>
      </div>
    </PublicLayout>
  );
};

export default Pricing;
