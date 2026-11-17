import { QueryClient, useQuery } from "@tanstack/react-query";
import type { PrerenderPayload, PublicSettlement } from "./types";
import { PUBLIC_LIST_COLUMNS, PUBLIC_SETTLEMENT_COLUMNS, toSummary } from "./types";
import {
  companySlug,
  idPrefixFromSlug,
  isOpen,
  settlementSlug,
  sortByDeadline,
  uuidRangeForPrefix,
} from "./format";

const STALE_MS = 5 * 60_000;

export const keys = {
  list: ["public-settlements"] as const,
  detail: (slug: string) => ["public-settlement", slug] as const,
  company: (slug: string) => ["public-company", slug] as const,
};

export interface SettlementPageData {
  settlement: PublicSettlement | null;
  related: PublicSettlement[];
}

// Loaded on demand so this module can also be evaluated at build time, where
// the browser-only Supabase client is not available.
async function db() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

type Db = Awaited<ReturnType<typeof db>>;

/**
 * Only listings an editor has approved, never demo, test, rejected or unreviewed rows. Not async on
 * purpose: query builders are thenables, so awaiting one would run it early.
 */
function publicRows(supabase: Db, columns: string = PUBLIC_LIST_COLUMNS) {
  return supabase
    .from("settlements")
    .select(columns)
    .eq("verified", true)
    .eq("is_demo", false)
    .eq("is_test", false)
    .neq("status", "rejected")
    .neq("status", "pending_review");
}

function rows(data: unknown): PublicSettlement[] {
  return Array.isArray(data) ? (data as PublicSettlement[]) : [];
}

/** List rows arrive without the long text columns; give them the full shape. */
function summaries(data: unknown): PublicSettlement[] {
  return rows(data).map(toSummary);
}

export async function fetchPublicSettlements(): Promise<PublicSettlement[]> {
  const { data, error } = await publicRows(await db()).limit(1000);
  if (error) throw new Error(error.message);
  return sortByDeadline(summaries(data));
}

/**
 * Other settlements worth showing next to this one: open ones first (same
 * company before same category), then closed ones from the same company.
 */
export function pickRelated(
  settlement: PublicSettlement,
  pool: PublicSettlement[],
  max = 4,
  now: Date = new Date(),
): PublicSettlement[] {
  const sameCompany = (s: PublicSettlement) => s.company === settlement.company;
  const sameCategory = (s: PublicSettlement) =>
    !!settlement.category && settlement.category !== "general" && s.category === settlement.category;
  const rank = (s: PublicSettlement) => (isOpen(s, now) ? 0 : 2) + (sameCompany(s) ? 0 : 1);
  return sortByDeadline(pool, now)
    .filter((s) => s.id !== settlement.id && (sameCompany(s) || (sameCategory(s) && isOpen(s, now))))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, max);
}

export async function fetchSettlementPage(slug: string): Promise<SettlementPageData> {
  const supabase = await db();
  const prefix = idPrefixFromSlug(slug);
  let found: PublicSettlement | null = null;

  if (prefix) {
    const [lo, hi] = uuidRangeForPrefix(prefix);
    const { data, error } = await publicRows(supabase, PUBLIC_SETTLEMENT_COLUMNS).gte("id", lo).lte("id", hi).limit(1);
    if (error) throw new Error(error.message);
    found = rows(data)[0] ?? null;
  }
  if (!found) {
    // Older links used the internal key as the slug.
    const { data, error } = await publicRows(supabase, PUBLIC_SETTLEMENT_COLUMNS).eq("canonical_key", slug).limit(1);
    if (error) throw new Error(error.message);
    found = rows(data)[0] ?? null;
  }
  if (!found) return { settlement: null, related: [] };

  const pool: PublicSettlement[] = [];
  const sameCompany = await publicRows(supabase).eq("company", found.company).neq("id", found.id).limit(8);
  pool.push(...summaries(sameCompany.data));
  if (found.category && found.category !== "general") {
    const sameCategory = await publicRows(supabase)
      .eq("category", found.category)
      .neq("id", found.id)
      .gte("claim_deadline", new Date().toISOString().slice(0, 10))
      .order("claim_deadline", { ascending: true })
      .limit(8);
    for (const r of summaries(sameCategory.data)) if (!pool.some((p) => p.id === r.id)) pool.push(r);
  }
  return { settlement: found, related: pickRelated(found, pool) };
}

/** Looks up one public settlement by its full id. */
export async function fetchSettlementById(id: string): Promise<PublicSettlement | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await publicRows(await db()).eq("id", id).limit(1);
  if (error) throw new Error(error.message);
  return summaries(data)[0] ?? null;
}

export function filterCompany(list: PublicSettlement[], slug: string): PublicSettlement[] {
  return list.filter((s) => companySlug(s.company) === slug);
}

export function usePublicSettlements() {
  return useQuery({ queryKey: keys.list, queryFn: fetchPublicSettlements, staleTime: STALE_MS });
}

export function useSettlementPage(slug: string) {
  return useQuery({
    queryKey: keys.detail(slug),
    queryFn: () => fetchSettlementPage(slug),
    staleTime: STALE_MS,
    enabled: !!slug,
  });
}

export function useCompanySettlements(slug: string) {
  return useQuery({
    queryKey: keys.company(slug),
    queryFn: async () => filterCompany(await fetchPublicSettlements(), slug),
    staleTime: STALE_MS,
    enabled: !!slug,
  });
}

/**
 * Fills the query cache from data embedded in a pre-rendered page, so the first
 * render shows real content immediately. Stale entries refetch in the background.
 */
export function seedQueryClient(client: QueryClient, payload: PrerenderPayload | undefined) {
  if (!payload) return;
  const updatedAt = Date.parse(payload.generatedAt) || Date.now();
  if (payload.settlements) {
    client.setQueryData(keys.list, payload.settlements, { updatedAt });
  }
  if (payload.settlement) {
    const data: SettlementPageData = { settlement: payload.settlement, related: payload.related ?? [] };
    client.setQueryData(keys.detail(settlementSlug(payload.settlement)), data, { updatedAt });
  }
  if (payload.company) {
    client.setQueryData(keys.company(payload.company.slug), payload.company.settlements, { updatedAt });
  }
}
