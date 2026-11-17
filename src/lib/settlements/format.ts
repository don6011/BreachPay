import type { PublicSettlement } from "./types";

export const SITE_NAME = "BreachPay";
export const SITE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://breachpay.com"
).replace(/\/$/, "");
export const DIRECTORY_PATH = "/data-breach-settlements";

const DAY_MS = 86_400_000;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Human title: the settlement name, prefixed by the company if the name omits it. */
export function displayName(s: Pick<PublicSettlement, "name" | "company">): string {
  const name = s.name.trim();
  const company = s.company.trim();
  if (!company || name.toLowerCase().includes(company.toLowerCase())) return name;
  return `${company}: ${name}`;
}

/**
 * URL slug: readable words plus the first 8 characters of the id. The id part
 * is what resolves the record, so the URL keeps working if the name is edited.
 */
export function settlementSlug(s: Pick<PublicSettlement, "id" | "name" | "company">): string {
  const words = slugify(displayName(s)) || "settlement";
  return `${words}-${s.id.slice(0, 8).toLowerCase()}`;
}

export function settlementPath(s: Pick<PublicSettlement, "id" | "name" | "company">): string {
  return `/settlement/${settlementSlug(s)}`;
}

/** Extracts the 8-hex id prefix from a slug, or null for legacy slugs. */
export function idPrefixFromSlug(slug: string): string | null {
  const m = /(?:^|-)([0-9a-f]{8})$/.exec(slug.toLowerCase());
  return m ? m[1] : null;
}

/** Inclusive uuid bounds matching every id that starts with the given prefix. */
export function uuidRangeForPrefix(prefix: string): [string, string] {
  return [`${prefix}-0000-0000-0000-000000000000`, `${prefix}-ffff-ffff-ffff-ffffffffffff`];
}

export function companySlug(company: string): string {
  return slugify(company);
}

export function companyPath(company: string): string {
  return `/breach/${companySlug(company)}`;
}

/** Parses a date-only or ISO string as a UTC calendar date. Returns null if unusable. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string | null {
  const d = parseDate(value);
  if (!d) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Compact date for titles, e.g. "Feb 15, 2027". */
export function shortDate(value: string | null | undefined): string | null {
  const d = parseDate(value);
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatMoney(n: number): string {
  const cents = n % 1 === 0 ? 0 : 2;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: cents, maximumFractionDigits: cents })}`;
}

/** Payout exactly as recorded. Never invents a figure: returns null when none is listed. */
export function payoutLabel(s: Pick<PublicSettlement, "payout_min" | "payout_max">): string | null {
  const min = s.payout_min && s.payout_min > 0 ? s.payout_min : null;
  const max = s.payout_max && s.payout_max > 0 ? s.payout_max : null;
  if (min && max && min !== max) return `${formatMoney(Math.min(min, max))} – ${formatMoney(Math.max(min, max))}`;
  if (max ?? min) return `Up to ${formatMoney((max ?? min)!)}`;
  return null;
}

export function effectiveDeadline(s: Pick<PublicSettlement, "claim_deadline" | "deadline">): string | null {
  return s.claim_deadline || s.deadline || null;
}

export type DeadlineState =
  | { kind: "open"; daysLeft: number; date: string }
  | { kind: "closed"; date: string | null }
  | { kind: "unknown" };

/** Whole days from today (UTC) until the deadline day; 0 means it closes today. */
export function daysUntil(value: string | null, now: Date = new Date()): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((d.getTime() - today) / DAY_MS);
}

export function deadlineState(
  s: Pick<PublicSettlement, "claim_deadline" | "deadline" | "status" | "lifecycle_status">,
  now: Date = new Date(),
): DeadlineState {
  const raw = effectiveDeadline(s);
  const days = daysUntil(raw, now);
  const markedClosed =
    s.status === "closed" ||
    s.status === "expired" ||
    s.lifecycle_status === "closed" ||
    s.lifecycle_status === "archived";
  if (markedClosed || (days !== null && days < 0)) {
    return { kind: "closed", date: formatDate(raw) };
  }
  if (days === null) return { kind: "unknown" };
  return { kind: "open", daysLeft: days, date: formatDate(raw)! };
}

export function isOpen(s: PublicSettlement, now: Date = new Date()): boolean {
  return deadlineState(s, now).kind !== "closed";
}

export function daysLeftLabel(days: number): string {
  if (days === 0) return "Closes today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/** Open settlements first by soonest deadline, then those without a listed deadline. */
export function sortByDeadline(list: PublicSettlement[], now: Date = new Date()): PublicSettlement[] {
  const key = (s: PublicSettlement) => daysUntil(effectiveDeadline(s), now) ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => key(a) - key(b) || a.company.localeCompare(b.company));
}

export function hostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface OutboundLink {
  url: string;
  host: string;
  /** True only for links an editor recorded as the official claim or notice site. */
  official: boolean;
  label: string;
}

/** Where to send someone to file. Prefers editor-confirmed official links. */
export function claimLink(s: PublicSettlement): OutboundLink | null {
  const candidates: Array<[string | null, boolean, string]> = [
    [s.claims_filing_url, true, "File on the official claim site"],
    [s.official_source_url, true, "Go to the official settlement site"],
    [s.claim_url, false, "Open the claim link"],
  ];
  for (const [url, official, label] of candidates) {
    const host = hostname(url);
    if (url && host) return { url, host, official, label };
  }
  return null;
}

export function sourceLinks(s: PublicSettlement): OutboundLink[] {
  const seen = new Set<string>();
  const out: OutboundLink[] = [];
  const add = (url: string | null, official: boolean, label: string) => {
    const host = hostname(url);
    if (!url || !host || seen.has(url)) return;
    seen.add(url);
    out.push({ url, host, official, label });
  };
  add(s.claims_filing_url, true, "Official claim form");
  add(s.official_source_url, true, "Official settlement notice");
  add(s.claim_url, false, "Claim link");
  add(s.source_url, false, s.source_name ? `Reported by ${s.source_name}` : "Where we found it");
  return out;
}

/**
 * The stored level reflects how many editorial checks a listing passed (one,
 * two, or three and more), so the wording describes the depth of review and
 * does not claim that any particular party confirmed the details.
 */
export const VERIFICATION_LABELS: Record<string, { label: string; detail: string }> = {
  source_linked: {
    label: "Basic review",
    detail: "An editor checked this listing against one source. Confirm the details on the official site before filing.",
  },
  court_verified: {
    label: "Standard review",
    detail:
      "An editor checked this listing against two points, such as the official site and the court reference. Confirm the details on the official site before filing.",
  },
  administrator_confirmed: {
    label: "Detailed review",
    detail:
      "An editor checked this listing against three or more points, such as the official site, the court reference and the administrator. Deadlines can still change, so confirm them on the official site.",
  },
};

export function verificationInfo(level: string | null | undefined) {
  return (
    (level && VERIFICATION_LABELS[level]) || {
      label: "Not independently confirmed",
      detail: "We have not confirmed these details against an official source. Check the official site before filing.",
    }
  );
}

export function categoryLabel(category: string | null | undefined): string | null {
  if (!category || category === "general") return null;
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
