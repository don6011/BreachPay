import type { PublicSettlement } from "./types";
import {
  DIRECTORY_PATH,
  SITE_NAME,
  SITE_URL,
  claimLink,
  companyPath,
  daysLeftLabel,
  deadlineState,
  displayName,
  effectiveDeadline,
  formatDate,
  payoutLabel,
  settlementPath,
  shortDate,
} from "./format";

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute canonical URL. */
  canonical: string;
  /** schema.org objects, emitted as one JSON-LD graph. */
  jsonLd: Record<string, unknown>[];
  /** Ask search engines not to index (used for empty or missing pages). */
  noindex?: boolean;
}

export interface Faq {
  q: string;
  a: string;
}

const abs = (path: string) => `${SITE_URL}${path}`;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

const TITLE_MAX = 65;

/**
 * Builds a page title that is never cut off mid-phrase: the optional detail and
 * then the site name are dropped before the main subject is shortened.
 */
export function fitTitle(subject: string, detail?: string): string {
  const candidates = [
    detail ? `${subject}: ${detail} | ${SITE_NAME}` : null,
    detail ? `${subject}: ${detail}` : null,
    `${subject} | ${SITE_NAME}`,
    subject,
  ];
  for (const c of candidates) if (c && c.length <= TITLE_MAX) return c;
  return clip(subject, TITLE_MAX);
}

function breadcrumbs(items: Array<[string, string]>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: abs(path),
    })),
  };
}

function faqSchema(faqs: Faq[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

const ORGANIZATION = {
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: abs("/logo.png"),
};

/**
 * Questions answered only from what is recorded for this settlement. Where a
 * fact is not on file the answer says so and points to the official notice.
 */
export function settlementFaqs(s: PublicSettlement, now: Date = new Date()): Faq[] {
  const state = deadlineState(s, now);
  const payout = payoutLabel(s);
  const link = claimLink(s);
  const company = s.company;
  const faqs: Faq[] = [];

  faqs.push({
    q: `What is the deadline to file a ${company} settlement claim?`,
    a:
      state.kind === "open"
        ? `The claim deadline we have on record is ${state.date}. Deadlines can change by court order, so confirm the date on the official settlement site before you file.`
        : state.kind === "closed"
          ? state.date
            ? `The claim deadline we have on record was ${state.date}, which has passed. Late claims are generally not accepted.`
            : "This settlement is marked as closed. Late claims are generally not accepted."
          : "We do not have a claim deadline on record for this settlement. Check the official settlement site for the current date.",
  });

  faqs.push({
    q: `How much is the ${company} settlement paying?`,
    a: payout
      ? `The amount listed is ${payout.replace(/^Up to/, "up to")} per valid claim. What you actually receive depends on the settlement terms, the proof you submit and how many people file, and can be lower than the listed amount.`
      : "We do not have a payout amount on record for this settlement. The official notice explains what each class member can claim.",
  });

  faqs.push({
    q: "Who is eligible to file?",
    a: s.eligibility_summary
      ? `${clip(s.eligibility_summary, 400)} The settlement administrator decides eligibility, not BreachPay.`
      : "Eligibility is set by the class definition in the official settlement notice. If you received a notice by mail or email, it usually includes an ID you can use on the claim form. The settlement administrator decides eligibility, not BreachPay.",
  });

  faqs.push({
    q: "Does it cost anything to file a claim?",
    a: "No. Filing a class action settlement claim is free, and you do not need to hire a lawyer to do it. BreachPay does not charge to list settlements or to link you to a claim form, and will never ask you to pay to file.",
  });

  faqs.push({
    q: "Where do I file?",
    a: link
      ? link.official
        ? `File on the official settlement site (${link.host}). BreachPay is an independent directory and does not accept claims.`
        : `The link we have on record goes to ${link.host}. We have not confirmed it as the official claim site, so check that it is the administrator's site before entering personal information.`
      : "We do not have a claim link on record for this settlement yet. Search for the settlement administrator's official site and check the address carefully before entering personal information.",
  });

  faqs.push({
    q: "When are payments sent?",
    a: s.final_approval_date && formatDate(s.final_approval_date)
      ? `The final approval hearing date on record is ${formatDate(s.final_approval_date)}. Payments are sent by the settlement administrator after final approval and after all claims are reviewed, which often takes several months.`
      : "Payments are sent by the settlement administrator after the court grants final approval and all claims are reviewed. That often takes several months after the claim deadline.",
  });

  return faqs;
}

export function settlementMeta(s: PublicSettlement, now: Date = new Date()): PageMeta {
  const name = displayName(s);
  const state = deadlineState(s, now);
  const payout = payoutLabel(s);
  const path = settlementPath(s);
  const faqs = settlementFaqs(s, now);

  const title =
    state.kind === "closed"
      ? fitTitle(name, "Claims Closed")
      : state.kind === "open"
        ? fitTitle(name, `Claim by ${shortDate(effectiveDeadline(s))}`)
        : fitTitle(name, "How to File a Claim");

  const parts: string[] = [];
  if (state.kind === "open") parts.push(`Claims close ${state.date}.`);
  if (state.kind === "closed") parts.push(state.date ? `The claim deadline was ${state.date}.` : "The claim period has ended.");
  if (payout) parts.push(`Listed payout: ${payout.replace(/^Up to/, "up to")}.`);
  parts.push(
    state.kind === "closed"
      ? "See the settlement details and what is still open."
      : "See who can file and get the link to the claim site. Filing is free.",
  );

  return {
    title,
    description: clip(parts.join(" "), 160),
    canonical: abs(path),
    jsonLd: [
      breadcrumbs([
        ["Home", "/"],
        ["Data breach settlements", DIRECTORY_PATH],
        [s.company, companyPath(s.company)],
        [name, path],
      ]),
      {
        "@type": "WebPage",
        name,
        url: abs(path),
        dateModified: s.last_verified_at || s.updated_at,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        publisher: ORGANIZATION,
      },
      faqSchema(faqs),
    ],
  };
}

export const HOME_FAQS: Faq[] = [
  {
    q: "What is a data breach settlement?",
    a: "When a company exposes customer data, affected people often sue as a group. If the case settles, the company funds a pool of money and anyone covered by the class definition can file a claim for a share, usually through a claim form run by a court-appointed settlement administrator.",
  },
  {
    q: "Does it cost anything to file a claim?",
    a: "No. Filing a claim in a class action settlement is free and you do not need a lawyer. Be wary of any site that charges a fee to file for you. BreachPay does not charge to list settlements or to link you to claim forms.",
  },
  {
    q: "How do I know if I am eligible?",
    a: "Each settlement defines who is covered. Many people get a notice by mail or email with a claim ID. If you did not get one, read the class definition on the official settlement site. The settlement administrator makes the final decision.",
  },
  {
    q: "How much will I get?",
    a: "It varies widely. Many settlements pay a modest flat amount without proof and a larger amount if you can document losses. The final payment depends on how many people file, so it can be lower than the amount listed in the notice.",
  },
  {
    q: "How do I avoid settlement scams?",
    a: "File only on the administrator's official site, which is named in the court-approved notice. A real claim form never asks for a fee, and should not need your full bank login or card PIN. BreachPay shows the web address of every link before you click it.",
  },
  {
    q: "Is BreachPay a law firm?",
    a: "No. BreachPay is an independent directory. We are not a law firm, we are not a settlement administrator, and we are not affiliated with the companies listed. Nothing here is legal advice.",
  },
];

export function homeMeta(): PageMeta {
  return {
    title: fitTitle("Open Data Breach Settlements and Claim Deadlines"),
    description:
      "A free, independent directory of data breach class action settlements: claim deadlines, listed payouts and links to the official claim sites. Filing is always free.",
    canonical: abs("/"),
    jsonLd: [
      { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
      ORGANIZATION,
      faqSchema(HOME_FAQS),
    ],
  };
}

export function directoryMeta(open: PublicSettlement[]): PageMeta {
  return {
    title: fitTitle("Data Breach Settlements Open Now", "Deadlines and Payouts"),
    description: clip(
      open.length > 0
        ? `${open.length} data breach settlement${open.length === 1 ? "" : "s"} currently open for claims, sorted by deadline, with listed payouts and links to the official claim sites.`
        : "Data breach class action settlements with claim deadlines, listed payouts and links to the official claim sites.",
      160,
    ),
    canonical: abs(DIRECTORY_PATH),
    jsonLd: [
      breadcrumbs([
        ["Home", "/"],
        ["Data breach settlements", DIRECTORY_PATH],
      ]),
      {
        "@type": "ItemList",
        name: "Open data breach settlements",
        numberOfItems: open.length,
        itemListElement: open.slice(0, 100).map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: displayName(s),
          url: abs(settlementPath(s)),
        })),
      },
    ],
  };
}

export function companyMeta(company: string, list: PublicSettlement[], now: Date = new Date()): PageMeta {
  const open = list.filter((s) => deadlineState(s, now).kind !== "closed");
  const path = companyPath(company);
  const soonest = open
    .map((s) => deadlineState(s, now))
    .find((st) => st.kind === "open");
  const description =
    open.length > 0
      ? `${open.length} ${company} data breach settlement${open.length === 1 ? " is" : "s are"} open for claims${
          soonest && soonest.kind === "open" ? `; the next deadline is ${soonest.date} (${daysLeftLabel(soonest.daysLeft).toLowerCase()})` : ""
        }. See who can file and where.`
      : `${company} data breach settlements on record, including closed claim periods.`;
  return {
    title: fitTitle(`${company} Data Breach Settlements`, "Open Claims and Deadlines"),
    description: clip(description, 160),
    canonical: abs(path),
    noindex: list.length === 0,
    jsonLd: [
      breadcrumbs([
        ["Home", "/"],
        ["Data breach settlements", DIRECTORY_PATH],
        [company, path],
      ]),
    ],
  };
}

/** Escapes a JSON string for safe embedding inside a <script> element. */
export function safeJson(value: unknown): string {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LS)
    .join("\\u2028")
    .split(PS)
    .join("\\u2029");
}

export function jsonLdGraph(meta: PageMeta): string {
  return safeJson({ "@context": "https://schema.org", "@graph": meta.jsonLd });
}
