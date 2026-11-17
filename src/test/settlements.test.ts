import { describe, expect, it } from "vitest";
import fixture from "./fixtures/settlements.json";
import { calendarLinks } from "@/components/public/AddToCalendar";
import {
  companyMeta,
  directoryMeta,
  fitTitle,
  jsonLdGraph,
  safeJson,
  settlementFaqs,
  settlementMeta,
} from "@/lib/settlements/content";
import { filterCompany, pickRelated } from "@/lib/settlements/data";
import {
  claimLink,
  companySlug,
  daysUntil,
  deadlineState,
  displayName,
  hostname,
  idPrefixFromSlug,
  isOpen,
  payoutLabel,
  settlementSlug,
  slugify,
  sortByDeadline,
  sourceLinks,
  uuidRangeForPrefix,
  verificationInfo,
} from "@/lib/settlements/format";
import type { PublicSettlement } from "@/lib/settlements/types";

const NOW = new Date("2026-11-17T06:00:00Z");
const all = fixture as unknown as PublicSettlement[];
const northwind = all[0];
const fabrikam = all[1];
const contoso = all[2];
const northwindClosed = all[3];

function make(overrides: Partial<PublicSettlement>): PublicSettlement {
  return { ...contoso, id: "99999999-0000-4000-8000-000000000000", name: "Test Settlement", company: "Test Co", ...overrides };
}

describe("slugs", () => {
  it("makes readable slugs", () => {
    expect(slugify("AT&T Inc.")).toBe("at-and-t-inc");
    expect(slugify("  Café  Société’s  ")).toBe("cafe-societes");
    expect(slugify("<script>alert(1)</script>")).toBe("script-alert-1-script");
    expect(companySlug("Fabrikam Health & Wellness")).toBe("fabrikam-health-and-wellness");
  });

  it("builds a settlement slug that carries the id prefix", () => {
    expect(settlementSlug(northwind)).toBe("northwind-credit-union-data-breach-settlement-11111111");
    // The company is prefixed only when the name does not already contain it.
    expect(settlementSlug(fabrikam)).toBe("fabrikam-health-and-wellness-data-breach-class-action-22222222");
    expect(displayName(fabrikam)).toBe("Fabrikam Health & Wellness: Data Breach Class Action");
  });

  it("resolves the id prefix from a slug and ignores legacy slugs", () => {
    expect(idPrefixFromSlug(settlementSlug(northwind))).toBe("11111111");
    expect(idPrefixFromSlug("ABCDEF12")).toBe("abcdef12");
    expect(idPrefixFromSlug("equifax:equifaxdatabreach")).toBeNull();
    expect(idPrefixFromSlug("some-settlement")).toBeNull();
    expect(uuidRangeForPrefix("11111111")).toEqual([
      "11111111-0000-0000-0000-000000000000",
      "11111111-ffff-ffff-ffff-ffffffffffff",
    ]);
  });
});

describe("deadlines", () => {
  it("counts whole days and treats the deadline day itself as open", () => {
    expect(daysUntil("2026-11-17", NOW)).toBe(0);
    expect(daysUntil("2026-11-22", NOW)).toBe(5);
    expect(daysUntil("2026-11-16", NOW)).toBe(-1);
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not a date", NOW)).toBeNull();
    expect(deadlineState(make({ claim_deadline: "2026-11-17" }), NOW)).toEqual({
      kind: "open",
      daysLeft: 0,
      date: "November 17, 2026",
    });
  });

  it("marks settlements closed by date or by status", () => {
    expect(deadlineState(northwindClosed, NOW)).toEqual({ kind: "closed", date: "September 1, 2026" });
    expect(deadlineState(make({ claim_deadline: "2027-01-01", lifecycle_status: "archived" }), NOW).kind).toBe("closed");
    expect(deadlineState(make({ claim_deadline: null, status: "closed" }), NOW)).toEqual({ kind: "closed", date: null });
    expect(deadlineState(make({ claim_deadline: "2027-01-01", status: "expired" }), NOW).kind).toBe("closed");
    expect(isOpen(northwind, NOW)).toBe(true);
    expect(isOpen(northwindClosed, NOW)).toBe(false);
  });

  it("reports an unknown deadline rather than guessing", () => {
    expect(deadlineState(contoso, NOW)).toEqual({ kind: "unknown" });
    expect(isOpen(contoso, NOW)).toBe(true);
  });

  it("sorts soonest first and puts unknown deadlines last", () => {
    const sorted = sortByDeadline([contoso, northwind, fabrikam], NOW).map((s) => s.company);
    expect(sorted).toEqual(["Fabrikam Health & Wellness", "Northwind Credit Union", "Contoso Telecom"]);
  });
});

describe("payouts", () => {
  it("shows only what is on record", () => {
    expect(payoutLabel(northwind)).toBe("$50 – $2,500");
    expect(payoutLabel(fabrikam)).toBe("Up to $125");
    expect(payoutLabel(northwindClosed)).toBe("Up to $20");
    expect(payoutLabel(make({ payout_min: 2500, payout_max: 50 }))).toBe("$50 – $2,500");
    expect(payoutLabel(make({ payout_min: 12.5, payout_max: null }))).toBe("Up to $12.50");
  });

  it("never invents a payout", () => {
    expect(payoutLabel(contoso)).toBeNull();
    expect(payoutLabel(make({ payout_min: 0, payout_max: 0 }))).toBeNull();
  });
});

describe("outbound links", () => {
  it("prefers the editor-confirmed claim form", () => {
    expect(claimLink(northwind)).toMatchObject({ host: "claims.example.com", official: true });
  });

  it("flags links that are not confirmed as official", () => {
    expect(claimLink(fabrikam)).toMatchObject({ host: "unconfirmed.example.net", official: false });
    expect(claimLink(contoso)).toBeNull();
  });

  it("rejects non-web addresses", () => {
    expect(hostname("javascript:alert(1)")).toBeNull();
    expect(hostname("data:text/html,x")).toBeNull();
    expect(hostname("not a url")).toBeNull();
    expect(hostname("https://www.example.com/a")).toBe("example.com");
    expect(claimLink(make({ claims_filing_url: "javascript:alert(1)" }))).toBeNull();
  });

  it("lists each source once", () => {
    expect(sourceLinks(northwind).map((l) => l.host)).toEqual(["claims.example.com", "example.com", "news.example.org"]);
    const dup = make({ claim_url: "https://a.example.com/x", source_url: "https://a.example.com/x" });
    expect(sourceLinks(dup)).toHaveLength(1);
  });
});

describe("verification wording", () => {
  it("uses the recorded level and does not overstate the rest", () => {
    expect(verificationInfo("administrator_confirmed").label).toBe("Detailed review");
    for (const level of ["source_linked", "court_verified", "administrator_confirmed"]) {
      // Levels count editorial checks; they must not claim a third party confirmed anything.
      const { label, detail } = verificationInfo(level);
      expect(`${label} ${detail}`).not.toMatch(/confirmed with|verified by the court|court verified|guarantee/i);
    }
    expect(verificationInfo("unverified").label).toBe("Not independently confirmed");
    expect(verificationInfo(null).label).toBe("Not independently confirmed");
  });
});

describe("page titles", () => {
  it("never cuts a title mid-phrase", () => {
    expect(fitTitle("Short Name", "Claim by Feb 15, 2027")).toBe("Short Name: Claim by Feb 15, 2027 | BreachPay");
    const long = "Northwind Credit Union Data Breach Settlement";
    const title = fitTitle(long, "Claim by Feb 15, 2027");
    expect(title.length).toBeLessThanOrEqual(65);
    expect(title).not.toContain("…");
    expect(title.startsWith(long)).toBe(true);
  });

  it("shortens only an overlong subject, at a word boundary", () => {
    const title = fitTitle("A ".repeat(60).trim());
    expect(title.length).toBeLessThanOrEqual(65);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("settlement page content", () => {
  it("states the deadline and payout on record", () => {
    const meta = settlementMeta(northwind, NOW);
    expect(meta.title).toBe("Northwind Credit Union Data Breach Settlement | BreachPay");
    expect(meta.description).toContain("Claims close February 15, 2027.");
    expect(meta.description).toContain("$50 – $2,500");
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.canonical).toBe("https://breachpay.com/settlement/northwind-credit-union-data-breach-settlement-11111111");
  });

  it("says so when facts are missing instead of filling them in", () => {
    const faqs = settlementFaqs(contoso, NOW);
    const text = faqs.map((f) => f.a).join(" ");
    expect(text).toContain("We do not have a claim deadline on record");
    expect(text).toContain("We do not have a payout amount on record");
    expect(text).toContain("We do not have a claim link on record");
    expect(text).not.toMatch(/\$\d/);
  });

  it("never promises eligibility, approval or a fee", () => {
    for (const s of [northwind, fabrikam, contoso, northwindClosed]) {
      const text = [settlementMeta(s, NOW).description, ...settlementFaqs(s, NOW).flatMap((f) => [f.q, f.a])].join(" ");
      expect(text).not.toMatch(/you (are|may be) (eligible|owed)|guarantee|success fee|court-approved|we (will )?file/i);
    }
  });

  it("warns when the only link is unconfirmed", () => {
    const where = settlementFaqs(fabrikam, NOW).find((f) => f.q === "Where do I file?");
    expect(where?.a).toContain("unconfirmed.example.net");
    expect(where?.a).toContain("have not confirmed");
  });

  it("describes a closed settlement as closed", () => {
    const meta = settlementMeta(northwindClosed, NOW);
    expect(meta.title).toContain("Claims Closed");
    expect(meta.description).toContain("The claim deadline was September 1, 2026.");
  });
});

describe("list pages", () => {
  const open = all.filter((s) => isOpen(s, NOW));

  it("builds directory metadata from the open list", () => {
    const meta = directoryMeta(open);
    expect(meta.description).toContain(`${open.length} data breach settlements currently open`);
    expect(meta.canonical).toBe("https://breachpay.com/data-breach-settlements");
  });

  it("groups a company's settlements and asks search engines to skip empty pages", () => {
    const list = filterCompany(all, "northwind-credit-union");
    expect(list.map((s) => s.id)).toEqual([northwind.id, northwindClosed.id]);
    expect(companyMeta("Northwind Credit Union", list, NOW).noindex).toBe(false);
    expect(companyMeta("Nobody", [], NOW).noindex).toBe(true);
  });

  it("puts open settlements first in related lists and omits unrelated closed ones", () => {
    const otherClosed = make({ id: "88888888-0000-4000-8000-000000000000", claim_deadline: "2026-01-01", category: "data_breach" });
    const related = pickRelated(northwind, [...all.slice(0, 4), otherClosed], 4, NOW).map((s) => s.id);
    expect(related).toEqual([fabrikam.id, contoso.id, northwindClosed.id]);
  });
});

describe("embedding and calendar output", () => {
  it("escapes data so it cannot close a script element", () => {
    const out = safeJson({ name: "</script><script>alert(1)</script>", amp: "a&b" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>", amp: "a&b" });
    expect(jsonLdGraph(settlementMeta(contoso, NOW))).not.toContain("<script>");
  });

  it("creates an all-day reminder on the deadline", () => {
    const links = calendarLinks(northwind)!;
    expect(links.google).toContain("dates=20270215/20270216");
    const ics = decodeURIComponent(links.ics.split(",")[1]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270215");
    expect(ics).toContain("DTEND;VALUE=DATE:20270216");
    expect(ics).toContain("SUMMARY:Claim deadline: Northwind Credit Union Data Breach Settlement");
    expect(calendarLinks(contoso)).toBeNull();
  });
});
