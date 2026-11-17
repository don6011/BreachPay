/**
 * The public shape of a settlement: only columns that are safe to show to
 * anonymous visitors. Internal notes and review metadata are never selected.
 */
export interface PublicSettlement {
  id: string;
  name: string;
  company: string;
  category: string | null;
  breach_year: number | null;
  description: string | null;
  eligibility_summary: string | null;
  payout_min: number | null;
  payout_max: number | null;
  claim_deadline: string | null;
  deadline: string | null;
  final_approval_date: string | null;
  jurisdiction: string | null;
  case_number: string | null;
  administrator_name: string | null;
  official_source_url: string | null;
  claims_filing_url: string | null;
  claim_url: string | null;
  source_url: string | null;
  source_name: string | null;
  status: string;
  lifecycle_status: string | null;
  verification_level: string | null;
  last_verified_at: string | null;
  updated_at: string;
  canonical_key: string;
}

const COLUMNS: Array<keyof PublicSettlement> = [
  "id",
  "name",
  "company",
  "category",
  "breach_year",
  "description",
  "eligibility_summary",
  "payout_min",
  "payout_max",
  "claim_deadline",
  "deadline",
  "final_approval_date",
  "jurisdiction",
  "case_number",
  "administrator_name",
  "official_source_url",
  "claims_filing_url",
  "claim_url",
  "source_url",
  "source_name",
  "status",
  "lifecycle_status",
  "verification_level",
  "last_verified_at",
  "updated_at",
  "canonical_key",
];

/** Long text shown only on a settlement's own page; left out of lists to keep them small. */
const DETAIL_ONLY: Array<keyof PublicSettlement> = ["description", "eligibility_summary"];

export const PUBLIC_SETTLEMENT_COLUMNS = COLUMNS.join(",");
export const PUBLIC_LIST_COLUMNS = COLUMNS.filter((c) => !DETAIL_ONLY.includes(c)).join(",");

/** The list form of a settlement: same shape, with the long text fields blank. */
export function toSummary(s: PublicSettlement): PublicSettlement {
  return { ...s, description: null, eligibility_summary: null };
}

/** Data embedded into pre-rendered pages so the first paint needs no request. */
export interface PrerenderPayload {
  generatedAt: string;
  /** Present on the home and directory pages. */
  settlements?: PublicSettlement[];
  /** Present on a settlement page. */
  settlement?: PublicSettlement;
  related?: PublicSettlement[];
  /** Present on a company page. */
  company?: { slug: string; settlements: PublicSettlement[] };
}

declare global {
  interface Window {
    __BREACHPAY_DATA__?: PrerenderPayload;
  }
}
