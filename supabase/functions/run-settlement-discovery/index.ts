import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SourceConfig {
  id: string;
  name: string;
  type: string;
  base_url: string | null;
  parser_type: string;
  is_active: boolean;
}

interface CandidateSettlement {
  name: string;
  company: string;
  claim_url?: string;
  claim_deadline?: string;
  payout_min?: number;
  payout_max?: number;
  eligibility_summary?: string;
  breach_year?: number;
  category?: string;
  source_url: string;
  source_type: string;
  administrator_name?: string;
}

async function hashFingerprint(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── TopClassActions Parser ──
async function parseTopClassActions(): Promise<CandidateSettlement[]> {
  const candidates: CandidateSettlement[] = [];
  try {
    const res = await fetch("https://topclassactions.com/category/lawsuit-settlements/open-class-action-settlements/", {
      headers: { "User-Agent": "BreachPay-SettlementBot/1.0" },
    });
    if (!res.ok) return candidates;
    const html = await res.text();

    // Extract article blocks - look for settlement entries
    const articleRegex = /<article[^>]*>[\s\S]*?<\/article>/gi;
    const articles = html.match(articleRegex) || [];

    for (const article of articles.slice(0, 20)) {
      const titleMatch = article.match(/<h[23][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;

      const url = titleMatch[1];
      const rawTitle = titleMatch[2].replace(/<[^>]*>/g, "").trim();
      if (!rawTitle || rawTitle.length < 10) continue;

      // Try to extract company name from title
      const companyMatch = rawTitle.match(/^([\w\s&.'-]+?)\s+(class action|settlement|data breach)/i);
      const company = companyMatch ? companyMatch[1].trim() : rawTitle.split(/\s+(settlement|class action)/i)[0]?.trim() || rawTitle;

      // Extract deadline if present
      const deadlineMatch = article.match(/deadline[:\s]*([\w]+\s+\d{1,2},?\s*\d{4})/i);

      // Extract payout if present
      const payoutMatch = article.match(/\$(\d[\d,.]*)\s*(?:[-–to]+\s*\$(\d[\d,.]*))?/i);

      candidates.push({
        name: rawTitle.substring(0, 200),
        company: company.substring(0, 100),
        source_url: url,
        source_type: "topclassactions",
        claim_deadline: deadlineMatch ? deadlineMatch[1] : undefined,
        payout_min: payoutMatch ? parseFloat(payoutMatch[1].replace(/,/g, "")) : undefined,
        payout_max: payoutMatch?.[2] ? parseFloat(payoutMatch[2].replace(/,/g, "")) : undefined,
        category: rawTitle.toLowerCase().includes("data breach") ? "data_breach" : "general",
      });
    }
  } catch (e) {
    console.error("TopClassActions parse error:", e);
  }
  return candidates;
}

// ── ClassAction.org Parser ──
async function parseClassActionOrg(): Promise<CandidateSettlement[]> {
  const candidates: CandidateSettlement[] = [];
  try {
    const res = await fetch("https://www.classaction.org/settlements", {
      headers: { "User-Agent": "BreachPay-SettlementBot/1.0" },
    });
    if (!res.ok) return candidates;
    const html = await res.text();

    const articleRegex = /<article[^>]*>[\s\S]*?<\/article>/gi;
    const linkRegex = /<a[^>]*href="(\/settlements\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const articles = html.match(articleRegex) || [];

    // Fallback: extract from links directly
    if (articles.length === 0) {
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const url = "https://www.classaction.org" + m[1];
        const rawTitle = m[2].replace(/<[^>]*>/g, "").trim();
        if (!rawTitle || rawTitle.length < 10) continue;

        const company = rawTitle.split(/\s+(settlement|class action)/i)[0]?.trim() || rawTitle;
        candidates.push({
          name: rawTitle.substring(0, 200),
          company: company.substring(0, 100),
          source_url: url,
          source_type: "classaction_org",
          category: rawTitle.toLowerCase().includes("data breach") ? "data_breach" : "general",
        });
        if (candidates.length >= 20) break;
      }
      return candidates;
    }

    for (const article of articles.slice(0, 20)) {
      const titleMatch = article.match(/<h[23][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;

      const url = titleMatch[1].startsWith("http") ? titleMatch[1] : "https://www.classaction.org" + titleMatch[1];
      const rawTitle = titleMatch[2].replace(/<[^>]*>/g, "").trim();
      if (!rawTitle) continue;

      const company = rawTitle.split(/\s+(settlement|class action)/i)[0]?.trim() || rawTitle;
      const deadlineMatch = article.match(/deadline[:\s]*([\w]+\s+\d{1,2},?\s*\d{4})/i);
      const payoutMatch = article.match(/\$(\d[\d,.]*)\s*(?:[-–to]+\s*\$(\d[\d,.]*))?/i);

      candidates.push({
        name: rawTitle.substring(0, 200),
        company: company.substring(0, 100),
        source_url: url,
        source_type: "classaction_org",
        claim_deadline: deadlineMatch ? deadlineMatch[1] : undefined,
        payout_min: payoutMatch ? parseFloat(payoutMatch[1].replace(/,/g, "")) : undefined,
        payout_max: payoutMatch?.[2] ? parseFloat(payoutMatch[2].replace(/,/g, "")) : undefined,
        category: rawTitle.toLowerCase().includes("data breach") ? "data_breach" : "general",
      });
    }
  } catch (e) {
    console.error("ClassAction.org parse error:", e);
  }
  return candidates;
}

// ── Kroll Parser ──
async function parseKroll(): Promise<CandidateSettlement[]> {
  const candidates: CandidateSettlement[] = [];
  try {
    const res = await fetch("https://www.krollsettlementadministration.com/", {
      headers: { "User-Agent": "BreachPay-SettlementBot/1.0" },
    });
    if (!res.ok) return candidates;
    const html = await res.text();

    // Kroll lists cases on their homepage with links
    const linkRegex = /<a[^>]*href="(https?:\/\/[^"]*kroll[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    const seen = new Set<string>();
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      const rawTitle = m[2].replace(/<[^>]*>/g, "").trim();
      if (!rawTitle || rawTitle.length < 5 || seen.has(url)) continue;
      seen.add(url);

      // Skip navigation/utility links
      if (rawTitle.toLowerCase().includes("privacy") || rawTitle.toLowerCase().includes("contact")) continue;

      candidates.push({
        name: rawTitle.substring(0, 200),
        company: rawTitle.split(/\s+(settlement|class action|litigation)/i)[0]?.trim() || rawTitle,
        source_url: url,
        source_type: "kroll",
        administrator_name: "Kroll Settlement Administration",
        category: rawTitle.toLowerCase().includes("data breach") || rawTitle.toLowerCase().includes("breach") ? "data_breach" : "general",
      });
      if (candidates.length >= 20) break;
    }
  } catch (e) {
    console.error("Kroll parse error:", e);
  }
  return candidates;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results = { discovered: 0, duplicates: 0, errors: [] as string[], sources_checked: 0 };

  try {
    // Get enabled sources
    const { data: sources } = await supabase
      .from("settlement_sources")
      .select("*")
      .eq("is_active", true);

    if (!sources?.length) {
      return new Response(JSON.stringify({ ...results, message: "No active sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run parsers based on source type
    let allCandidates: CandidateSettlement[] = [];

    for (const source of sources) {
      results.sources_checked++;
      try {
        let candidates: CandidateSettlement[] = [];
        const parserType = source.parser_type || source.type;

        if (parserType === "topclassactions" || source.name?.toLowerCase().includes("topclass")) {
          candidates = await parseTopClassActions();
        } else if (parserType === "classaction_org" || source.name?.toLowerCase().includes("classaction.org")) {
          candidates = await parseClassActionOrg();
        } else if (parserType === "kroll" || source.name?.toLowerCase().includes("kroll")) {
          candidates = await parseKroll();
        }
        // Tag each candidate with source_id
        candidates.forEach((c) => (c as any)._source_id = source.id);
        allCandidates = allCandidates.concat(candidates);
      } catch (e: any) {
        results.errors.push(`Source ${source.name}: ${e.message}`);
      }
    }

    // Dedupe and ingest
    for (const candidate of allCandidates) {
      try {
        const fp = await hashFingerprint(`${candidate.company}:${candidate.name}:${candidate.source_url}`);

        // Check if fingerprint already exists
        const { data: existing } = await supabase
          .from("settlement_raw_ingest")
          .select("id")
          .eq("fingerprint", fp)
          .maybeSingle();

        if (existing) {
          results.duplicates++;
          continue;
        }

        // Insert into raw ingest
        const { error: ingestError } = await supabase
          .from("settlement_raw_ingest")
          .insert({
            source_id: (candidate as any)._source_id || null,
            raw_url: candidate.source_url,
            raw_payload: candidate as any,
            content_hash: fp,
            fingerprint: fp,
            normalized: {
              name: candidate.name,
              company: candidate.company,
              claim_url: candidate.claim_url || null,
              claim_deadline: candidate.claim_deadline || null,
              payout_min: candidate.payout_min || null,
              payout_max: candidate.payout_max || null,
              eligibility_summary: candidate.eligibility_summary || null,
              breach_year: candidate.breach_year || null,
              category: candidate.category || "general",
              source_type: candidate.source_type,
              administrator_name: candidate.administrator_name || null,
            },
            status: "parsed",
            fetched_at: new Date().toISOString(),
          });

        if (ingestError) {
          // Likely duplicate fingerprint race condition
          if (ingestError.message?.includes("duplicate")) {
            results.duplicates++;
          } else {
            results.errors.push(`Ingest ${candidate.company}: ${ingestError.message}`);
          }
          continue;
        }

        // Upsert into settlements as pending
        const canonicalKey = `${candidate.company}:${candidate.name}`.toLowerCase().replace(/[^a-z0-9:]/g, "");

        const { data: existingSettlement } = await supabase
          .from("settlements")
          .select("id")
          .eq("canonical_key", canonicalKey)
          .maybeSingle();

        if (!existingSettlement) {
          await supabase.from("settlements").insert({
            name: candidate.name,
            company: candidate.company,
            canonical_key: canonicalKey,
            status: "pending_review",
            verified: false,
            verification_level: "unverified",
            verification_status: "pending",
            is_demo: false,
            is_test: false,
            source_url: candidate.source_url,
            source_type: candidate.source_type,
            claim_url: candidate.claim_url || null,
            claim_deadline: candidate.claim_deadline || null,
            payout_min: candidate.payout_min || null,
            payout_max: candidate.payout_max || null,
            eligibility_summary: candidate.eligibility_summary || null,
            category: candidate.category || "general",
            administrator_name: candidate.administrator_name || null,
            discovered_at: new Date().toISOString(),
            verification_sources: [{ url: candidate.source_url, type: candidate.source_type }],
          });

          // Add to verification queue
          const { data: newSettlement } = await supabase
            .from("settlements")
            .select("id")
            .eq("canonical_key", canonicalKey)
            .maybeSingle();

          if (newSettlement) {
            await supabase.from("settlement_verification_queue").insert({
              settlement_id: newSettlement.id,
              priority: candidate.category === "data_breach" ? 80 : 50,
              reason: `Discovered from ${candidate.source_type}`,
              status: "open",
            });
          }

          results.discovered++;
        } else {
          // Update last_checked_at
          await supabase
            .from("settlements")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", existingSettlement.id);
          results.duplicates++;
        }
      } catch (e: any) {
        results.errors.push(`Process ${candidate.company}: ${e.message}`);
      }
    }

    // Auto-archive expired settlements
    await supabase.rpc("auto_archive_expired_settlements");

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
