import { Link } from "react-router-dom";
import { FaqList } from "@/components/public/FaqList";
import { PublicLayout } from "@/components/public/PublicLayout";
import { HOME_FAQS, type Faq, type PageMeta } from "@/lib/settlements/content";
import { DIRECTORY_PATH, SITE_NAME, SITE_URL } from "@/lib/settlements/format";
import { SUPPORT_EMAIL } from "@/lib/site";
import { useSeo } from "@/lib/useSeo";

export const ACCOUNT_FAQS: Faq[] = [
  {
    q: "Can I get deadline reminders without an account?",
    a: "Yes. On any open settlement, enter your email under \"Get a reminder before it closes\". After you confirm your address, we email you a week before and the day before the deadline. You can also get one weekly email with newly listed settlements and upcoming deadlines.",
  },
  {
    q: "What does the breach check do?",
    a: "It looks up your account email address in the Have I Been Pwned database of known breaches and lists the ones that include it. Only the email address you signed up with is checked.",
  },
  {
    q: "What is a match?",
    a: "A match means a settlement we list involves a company from your breach check results. It is a place to start looking, not a decision. The settlement administrator decides who is eligible.",
  },
  {
    q: "Does BreachPay file my claim?",
    a: "No. You file on the settlement administrator's official site. In your account you can mark a claim as filed to keep track of what you have done.",
  },
  {
    q: "Who pays me if my claim is approved?",
    a: "The settlement administrator pays you directly, by the method you chose on the claim form. BreachPay never receives or sends settlement money.",
  },
  {
    q: "How do I stop emails from BreachPay?",
    a: "Every reminder and weekly email has an unsubscribe link. For account alerts, open Settings and turn off email alerts. Emails about signing in, such as password resets, are still sent when you ask for them.",
  },
  {
    q: "How do I delete my account?",
    a: "Open Settings in your account and choose Delete Account. This removes your profile, breach check results, matches and claim records.",
  },
];

export const HELP_META: PageMeta = {
  title: `Help | ${SITE_NAME}`,
  description: "How BreachPay works: finding data breach settlements, filing a claim on the official site, the breach check and your account.",
  canonical: `${SITE_URL}/help`,
  jsonLd: [
    {
      "@type": "FAQPage",
      mainEntity: [...HOME_FAQS, ...ACCOUNT_FAQS].map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const Help = () => {
  useSeo(HELP_META);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help</h1>
        <p className="mt-3 text-muted-foreground">
          Answers to common questions. Looking for a settlement?{" "}
          <Link to={DIRECTORY_PATH} className="text-primary hover:underline">
            Browse the directory
          </Link>
          .
        </p>

        <h2 className="mt-10 text-xl font-semibold">Settlements and claims</h2>
        <div className="mt-4">
          <FaqList faqs={HOME_FAQS} />
        </div>

        <h2 className="mt-10 text-xl font-semibold">Your account</h2>
        <div className="mt-4">
          <FaqList faqs={ACCOUNT_FAQS} />
        </div>

        <h2 className="mt-10 text-xl font-semibold">Something wrong with a listing?</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Settlement details can change after we publish them. If a deadline, amount or link here differs from the
          official settlement notice, the official notice is right.
          {SUPPORT_EMAIL ? (
            <>
              {" "}
              You can tell us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we will correct it.
            </>
          ) : null}
        </p>
      </div>
    </PublicLayout>
  );
};

export default Help;
