import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, loadEnv, type Plugin, type ResolvedConfig } from "vite";

/**
 * Pre-renders the public pages to static HTML at the end of `vite build`, so
 * search engines and people on slow connections get real content without
 * waiting for JavaScript. Also writes sitemap.xml and robots.txt.
 *
 * Data comes from the public settlements API (the same rows the site shows to
 * any visitor). If it can't be reached the build still succeeds and the pages
 * fall back to loading in the browser.
 *
 *   PRERENDER=0              skip this step
 *   PRERENDER_STRICT=1       fail the build if pre-rendering fails
 *   PRERENDER_DATA_FILE=...  read settlements from a JSON file instead (tests)
 */
export function prerender(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "breachpay-prerender",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      if (config.build.ssr || process.env.PRERENDER === "0") return;
      try {
        await run(config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.PRERENDER_STRICT === "1") throw error;
        config.logger.warn(`\n[prerender] skipped: ${message}\n[prerender] the site still works; pages will load their data in the browser.`);
      }
    },
  };
}

interface Rendered {
  path: string;
  html: string;
  meta: { title: string; description: string; canonical: string; noindex?: boolean; jsonLd: unknown[] };
  payload: unknown;
  lastmod: string;
}

interface Entry {
  PUBLIC_SETTLEMENT_COLUMNS: string;
  SITE_NAME: string;
  SITE_URL: string;
  renderSite(settlements: unknown[], generatedAt: string): Rendered[];
  jsonLdGraph(meta: Rendered["meta"]): string;
  safeJson(value: unknown): string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function loadSettlements(config: ResolvedConfig, columns: string): Promise<unknown[]> {
  const file = process.env.PRERENDER_DATA_FILE;
  if (file) {
    const parsed = JSON.parse(await fs.readFile(path.resolve(config.root, file), "utf8"));
    if (!Array.isArray(parsed)) throw new Error(`${file} must contain a JSON array`);
    return parsed;
  }

  const env = loadEnv(config.mode, config.root, "VITE_");
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set");

  // Same columns and filter the site uses in the browser: approved listings only.
  const query =
    `select=${columns}&verified=eq.true&is_demo=eq.false&is_test=eq.false` +
    "&status=not.in.(rejected,pending_review)&limit=1000";
  const response = await fetch(`${url}/rest/v1/settlements?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`settlements request failed with HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("settlements response was not a list");
  return rows;
}

/** Keeps only the public columns, so nothing internal can reach the built HTML. */
function publicOnly(rows: unknown[], columns: string[]): unknown[] {
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .filter((r) => r.verified !== false && r.is_demo !== true && r.is_test !== true)
    .filter((r) => r.status !== "rejected" && r.status !== "pending_review")
    .filter((r) => typeof r.id === "string" && typeof r.name === "string" && typeof r.company === "string")
    .map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null])));
}

function buildHtml(template: string, page: Rendered, entry: Entry): string {
  const { meta } = page;
  const image = `${entry.SITE_URL}/og-image.png`;
  const head = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.noindex ? "noindex, follow" : "index, follow"}" />`,
    meta.canonical ? `<link rel="canonical" href="${esc(meta.canonical)}" />` : "",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(entry.SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    meta.canonical ? `<meta property="og:url" content="${esc(meta.canonical)}" />` : "",
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    meta.jsonLd.length > 0
      ? `<script type="application/ld+json" id="page-jsonld">${entry.jsonLdGraph(meta)}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  // If a host serves this file for some other address (single-page fallback),
  // drop the pre-rendered content before it can be shown or indexed there.
  const guard =
    `<script>(function(){var p=location.pathname.replace(/\\/+$/,"")||"/";` +
    `if(p!==${entry.safeJson(page.path)}){document.getElementById("root").innerHTML="";` +
    `var h=document.head,q=function(s){var e=h.querySelector(s);if(e)e.remove()};` +
    `q('link[rel="canonical"]');q("#page-jsonld");q('meta[property="og:url"]');` +
    `document.title=${entry.safeJson(entry.SITE_NAME)}}})()</script>`;
  const data = `<script>window.__BREACHPAY_DATA__=${entry.safeJson(page.payload)}</script>`;

  const seo = /<!--seo-->[\s\S]*?<!--\/seo-->/;
  const root = /<div id="root"><\/div>/;
  if (!seo.test(template) || !root.test(template)) {
    throw new Error("index.html is missing the <!--seo--> block or the empty #root element");
  }
  return template
    .replace(seo, () => head)
    .replace(root, () => `<div id="root">${page.html}</div>\n    ${guard}\n    ${data}`);
}

async function writePage(outDir: string, pagePath: string, html: string) {
  if (pagePath === "/") {
    await fs.writeFile(path.join(outDir, "index.html"), html);
    return;
  }
  const rel = pagePath.replace(/^\/+/, "");
  // Both layouts, so every static host answers the bare URL without a redirect.
  await fs.mkdir(path.join(outDir, rel), { recursive: true });
  await fs.writeFile(path.join(outDir, rel, "index.html"), html);
  await fs.writeFile(path.join(outDir, `${rel}.html`), html);
}

async function run(config: ResolvedConfig) {
  const outDir = path.resolve(config.root, config.build.outDir);
  const template = await fs.readFile(path.join(outDir, "index.html"), "utf8");

  // Compile the page components for Node with the app's own config, so aliases
  // and JSX behave exactly as they do in the browser bundle.
  const work = path.join(config.root, "node_modules", ".prerender");
  await build({
    root: config.root,
    mode: config.mode,
    logLevel: "error",
    build: {
      ssr: "src/prerender/entry.tsx",
      outDir: work,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { output: { format: "esm", entryFileNames: "entry.mjs" } },
    },
  });
  const entry = (await import(`${pathToFileURL(path.join(work, "entry.mjs")).href}?t=${Date.now()}`)) as Entry;

  const columns = entry.PUBLIC_SETTLEMENT_COLUMNS;
  const raw = await loadSettlements(config, columns);
  const pages = entry.renderSite(publicOnly(raw, columns.split(",")), new Date().toISOString());

  for (const page of pages) {
    await writePage(outDir, page.path, buildHtml(template, page, entry));
  }

  const urls = pages
    .filter((p) => !p.meta.noindex)
    .map((p) => `  <url><loc>${esc(entry.SITE_URL + (p.path === "/" ? "/" : p.path))}</loc><lastmod>${p.lastmod}</lastmod></url>`);
  await fs.writeFile(
    path.join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
  );
  await fs.writeFile(
    path.join(outDir, "robots.txt"),
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /partner",
      "Disallow: /dashboard",
      "",
      `Sitemap: ${entry.SITE_URL}/sitemap.xml`,
      "",
    ].join("\n"),
  );

  config.logger.info(`\n[prerender] wrote ${pages.length} pages, sitemap.xml and robots.txt`);
}
