import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // The site now publishes a static sitemap at build time, which lists only
  // published listings. Send anything still pointing here to it.
  const site = (Deno.env.get("APP_BASE_URL") || "https://breachpay.com").replace(/\/$/, "");
  return Response.redirect(`${site}/sitemap.xml`, 301);

  // eslint-disable-next-line no-unreachable
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const baseUrl = req.headers.get("origin") || "https://breachpay.com";

  // Fetch verified settlements
  const { data: settlements } = await supabase
    .from("settlements")
    .select("canonical_key, updated_at, company")
    .eq("verified", true);

  // Fetch active breach catalog companies
  const { data: breaches } = await supabase
    .from("breach_catalog")
    .select("company, updated_at")
    .eq("active", true)
    .eq("verified", true);

  // Dedupe companies
  const companies = new Map<string, string>();
  for (const b of breaches || []) {
    const slug = b.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!companies.has(slug) || b.updated_at > companies.get(slug)!) {
      companies.set(slug, b.updated_at);
    }
  }
  // Also add settlement companies
  for (const s of settlements || []) {
    const slug = s.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!companies.has(slug) || s.updated_at > companies.get(slug)!) {
      companies.set(slug, s.updated_at);
    }
  }

  const urls: string[] = [];

  // Static pages
  urls.push(`<url><loc>${baseUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`);
  urls.push(`<url><loc>${baseUrl}/pricing</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`);

  // Settlement pages
  for (const s of settlements || []) {
    urls.push(`<url><loc>${baseUrl}/settlement/${s.canonical_key}</loc><lastmod>${s.updated_at.split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`);
    urls.push(`<url><loc>${baseUrl}/check/${s.canonical_key}</loc><lastmod>${s.updated_at.split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  // Breach company pages
  for (const [slug, updatedAt] of companies) {
    urls.push(`<url><loc>${baseUrl}/breach/${slug}</loc><lastmod>${updatedAt.split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
