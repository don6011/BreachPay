/**
 * Build-time rendering of the public pages. Compiled and run by the pre-render
 * step (vite-plugin-prerender.ts); never shipped to the browser.
 */
import { renderToString } from "react-dom/server";
import { Route, Routes, StaticRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Landing from "@/pages/Landing";
import Directory from "@/pages/Directory";
import SettlementPublic from "@/pages/SettlementPublic";
import BreachCompany from "@/pages/BreachCompany";
import Pricing, { PRICING_META } from "@/pages/Pricing";
import Help, { HELP_META } from "@/pages/Help";
import TermsOfService, { TERMS_META } from "@/pages/TermsOfService";
import PrivacyPolicy, { PRIVACY_META } from "@/pages/PrivacyPolicy";
import {
  type PageMeta,
  companyMeta,
  directoryMeta,
  homeMeta,
  jsonLdGraph,
  safeJson,
  settlementMeta,
} from "@/lib/settlements/content";
import { filterCompany, pickRelated, seedQueryClient } from "@/lib/settlements/data";
import {
  DIRECTORY_PATH,
  SITE_NAME,
  SITE_URL,
  companyPath,
  companySlug,
  isOpen,
  settlementPath,
  sortByDeadline,
} from "@/lib/settlements/format";
import {
  PUBLIC_SETTLEMENT_COLUMNS,
  type PrerenderPayload,
  type PublicSettlement,
  toSummary,
} from "@/lib/settlements/types";

export interface RenderedPage {
  path: string;
  html: string;
  meta: PageMeta;
  payload: PrerenderPayload;
  lastmod: string;
}

export { PUBLIC_SETTLEMENT_COLUMNS, SITE_NAME, SITE_URL, jsonLdGraph, safeJson };

function render(path: string, payload: PrerenderPayload): string {
  const client = new QueryClient();
  seedQueryClient(client, payload);
  return renderToString(
    <QueryClientProvider client={client}>
      <StaticRouter location={path}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/help" element={<Help />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path={DIRECTORY_PATH} element={<Directory />} />
          <Route path="/settlement/:slug" element={<SettlementPublic />} />
          <Route path="/breach/:company" element={<BreachCompany />} />
        </Routes>
      </StaticRouter>
    </QueryClientProvider>,
  );
}

/** Renders every public page for the given approved settlements. */
export function renderSite(input: PublicSettlement[], generatedAt: string): RenderedPage[] {
  const full = sortByDeadline(input);
  const list = full.map(toSummary);
  const open = list.filter((s) => isOpen(s));
  const day = generatedAt.slice(0, 10);
  const pages: RenderedPage[] = [];

  const add = (path: string, meta: PageMeta, payload: PrerenderPayload, lastmod = day) =>
    pages.push({ path, meta, payload, lastmod, html: render(path, payload) });

  add("/", homeMeta(), { generatedAt, settlements: list });
  add(DIRECTORY_PATH, directoryMeta(open), { generatedAt, settlements: list });
  add("/pricing", PRICING_META, { generatedAt });
  add("/help", HELP_META, { generatedAt });
  add("/terms", TERMS_META, { generatedAt });
  add("/privacy", PRIVACY_META, { generatedAt });

  for (const settlement of full) {
    add(
      settlementPath(settlement),
      settlementMeta(settlement),
      { generatedAt, settlement, related: pickRelated(settlement, list) },
      (settlement.last_verified_at || settlement.updated_at || generatedAt).slice(0, 10),
    );
  }

  const companies = new Map<string, string>();
  for (const s of list) if (!companies.has(companySlug(s.company))) companies.set(companySlug(s.company), s.company);
  for (const [slug, company] of companies) {
    if (!slug) continue;
    const settlements = filterCompany(list, slug);
    add(companyPath(company), companyMeta(company, settlements), { generatedAt, company: { slug, settlements } });
  }

  return pages;
}
