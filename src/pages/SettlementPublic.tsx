import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PayoutRange } from "@/components/PayoutRange";
import { DeadlineBadge, isDeadlinePassed } from "@/components/DeadlineBadge";
import { VerificationBadge } from "@/components/VerificationBadge";
import logo from "@/assets/logo.png";
import {
  ArrowRight, Clock, AlertTriangle, Shield, Scale, MapPin, Hash,
  Building2, ExternalLink, HelpCircle, ChevronDown, ChevronUp,
} from "lucide-react";

interface SettlementPublicData {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  description: string | null;
  eligibility_summary: string | null;
  category: string | null;
  payout_min: number | null;
  payout_max: number | null;
  claim_deadline: string | null;
  deadline: string | null;
  jurisdiction: string | null;
  case_number: string | null;
  administrator_name: string | null;
  official_source_url: string | null;
  claims_filing_url: string | null;
  verified: boolean;
  verification_level: string;
  status: string;
  tags: string[];
  canonical_key: string;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const faqItems = [
  {
    q: "How do I know if I'm eligible?",
    a: "If your personal data was exposed in this breach during the affected time period, you may be eligible. Use our free scan to check instantly.",
  },
  {
    q: "How much could I receive?",
    a: "Payout amounts depend on the type of data exposed and the settlement terms. Our estimated range is based on historical settlement data.",
  },
  {
    q: "Is there a cost to file?",
    a: "BreachPay charges no upfront fees. We only take a 15% fee if your claim is successfully paid out.",
  },
  {
    q: "How long does the process take?",
    a: "Most claims are reviewed within 30-90 days after the filing deadline. Payouts typically arrive 1-6 months after approval.",
  },
];

const SettlementPublic = () => {
  const { slug } = useParams<{ slug: string }>();
  const [settlement, setSettlement] = useState<SettlementPublicData | null>(null);
  const [related, setRelated] = useState<SettlementPublicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchSettlement = async () => {
      // Try canonical_key match first, then fuzzy name match
      const { data } = await supabase
        .from("settlements")
        .select("id, name, company, breach_year, description, eligibility_summary, category, payout_min, payout_max, claim_deadline, deadline, jurisdiction, case_number, administrator_name, official_source_url, claims_filing_url, verified, verification_level, status, tags, canonical_key")
        .eq("verified", true)
        .or(`canonical_key.eq.${slug},canonical_key.ilike.%${slug}%`);

      const match = data?.[0] as SettlementPublicData | undefined;
      if (match) {
        setSettlement(match);

        // Fetch related settlements (same company or category)
        const { data: rel } = await supabase
          .from("settlements")
          .select("id, name, company, breach_year, description, eligibility_summary, category, payout_min, payout_max, claim_deadline, deadline, jurisdiction, case_number, administrator_name, official_source_url, claims_filing_url, verified, verification_level, status, tags, canonical_key")
          .eq("verified", true)
          .neq("id", match.id)
          .or(`company.eq.${match.company},category.eq.${match.category || "none"}`)
          .limit(4);

        setRelated((rel || []) as SettlementPublicData[]);
      }
      setLoading(false);
    };

    fetchSettlement();
  }, [slug]);

  // Set page title and meta
  useEffect(() => {
    if (!settlement) return;
    const title = `${settlement.company} Data Breach Settlement (${settlement.breach_year || "Recent"}) | BreachPay`;
    document.title = title;

    // Set meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = `Find out if you're eligible for the ${settlement.company} data breach settlement. Estimated payout: $${settlement.payout_min || 0} – $${settlement.payout_max || 0}. File your claim before the deadline.`;
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = desc;
      document.head.appendChild(meta);
    }

    // JSON-LD structured data
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "FAQPage",
          mainEntity: faqItems.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
        {
          "@type": "Event",
          name: `${settlement.company} Settlement Claim Deadline`,
          startDate: settlement.claim_deadline || settlement.deadline,
          eventStatus: "https://schema.org/EventScheduled",
          description: `Deadline to file a claim for the ${settlement.company} data breach settlement.`,
          organizer: {
            "@type": "Organization",
            name: settlement.administrator_name || "Settlement Administrator",
          },
        },
        {
          "@type": "WebPage",
          name: title,
          description: desc,
          url: window.location.href,
        },
      ],
    };

    let scriptEl = document.getElementById("settlement-jsonld");
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = "settlement-jsonld";
      scriptEl.setAttribute("type", "application/ld+json");
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(jsonLd);

    return () => {
      scriptEl?.remove();
    };
  }, [settlement]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-background/85">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link to="/"><img src={logo} alt="BreachPay" className="h-10" /></Link>
            <Button asChild className="rounded-xl"><Link to="/scan">Run My Free Scan</Link></Button>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Settlement Not Found</h1>
          <p className="text-muted-foreground mb-6">This settlement page doesn't exist or hasn't been verified yet.</p>
          <Button asChild className="rounded-xl"><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  const effectiveDeadline = settlement.claim_deadline || settlement.deadline;
  const daysLeft = effectiveDeadline
    ? Math.max(0, Math.ceil((new Date(effectiveDeadline).getTime() - Date.now()) / 86400000))
    : null;
  const isUrgent = daysLeft !== null && daysLeft <= 30;
  const isClosed = settlement.status === "closed" || isDeadlinePassed(effectiveDeadline);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-background/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/"><img src={logo} alt="BreachPay" className="h-10" /></Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Log In</Link></Button>
            <Button asChild className="rounded-xl"><Link to="/scan">Run My Free Scan</Link></Button>
          </div>
        </div>
      </header>

      {/* Deadline Banner */}
      {isUrgent && !isClosed && daysLeft !== null && (
        <div className="bg-critical/10 border-b border-critical/20 py-3">
          <div className="mx-auto max-w-6xl px-6 flex items-center justify-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-critical" />
            <span className="font-semibold text-critical">⏳ {daysLeft} days left to file your claim</span>
            <span className="text-muted-foreground">— Don't miss your deadline.</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* H1 */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          {settlement.company} Data Breach Settlement{settlement.breach_year ? ` (${settlement.breach_year})` : ""}
        </h1>
        <div className="flex items-center gap-2 flex-wrap mb-8">
          <VerificationBadge level={settlement.verification_level} verified={settlement.verified} compact />
          <DeadlineBadge deadline={effectiveDeadline} />
          {settlement.category && (
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">{settlement.category}</span>
          )}
        </div>

        {/* Section 1: Overview */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> What Happened
          </h2>
          <div className="glass-card p-6 space-y-4">
            {settlement.description && <p className="text-muted-foreground">{settlement.description}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {settlement.breach_year && (
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Breach Year:</span>
                  <span className="font-medium">{settlement.breach_year}</span>
                </div>
              )}
              {settlement.jurisdiction && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Jurisdiction:</span>
                  <span className="font-medium">{settlement.jurisdiction}</span>
                </div>
              )}
              {settlement.case_number && (
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Case:</span>
                  <span className="font-medium">{settlement.case_number}</span>
                </div>
              )}
              {settlement.administrator_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Administrator:</span>
                  <span className="font-medium">{settlement.administrator_name}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Am I Eligible? */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Am I Eligible?</h2>
          <div className="glass-card p-6">
            {settlement.eligibility_summary ? (
              <p className="text-muted-foreground">{settlement.eligibility_summary}</p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {settlement.breach_year && (
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    You were a customer or user of {settlement.company} during or before {settlement.breach_year}.
                  </li>
                )}
                {settlement.category && (
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    This settlement covers <span className="font-medium text-foreground">{settlement.category}</span> related claims.
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Your personal information (email, phone, SSN, etc.) may have been exposed in the breach.
                </li>
              </ul>
            )}
            <Button asChild className="mt-6 rounded-xl" size="lg">
              <Link to={`/check/${settlement.canonical_key}`}>
                Check If I Qualify <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Section 3: How Much Could I Get? */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">How Much Could I Get?</h2>
          <div className="glass-card-glow p-6 text-center">
            <PayoutRange min={settlement.payout_min || 0} max={settlement.payout_max || 0} size="lg" className="justify-center mb-3" />
            <p className="text-sm text-muted-foreground">
              Actual amounts depend on the number of claimants, type of data exposed, and settlement terms.
            </p>
            {effectiveDeadline && (
              <div className={`mt-4 flex items-center justify-center gap-2 text-sm ${isUrgent ? "text-critical font-semibold" : "text-muted-foreground"}`}>
                {isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                Claim deadline: {effectiveDeadline}
                {daysLeft !== null && <span>({daysLeft} days left)</span>}
              </div>
            )}
          </div>
        </section>

        {/* Section 4: File a Claim CTA */}
        {!isClosed && (
          <section className="mb-10">
            <div className="glass-card-glow p-8 text-center">
              <h2 className="text-2xl font-bold mb-2">Ready to File Your Claim?</h2>
              <p className="text-muted-foreground mb-6">
                Find out in minutes if you're owed money. No upfront fees — we only get paid if you do.
              </p>
              <Button asChild size="lg" className="rounded-xl shadow-[0_0_20px_hsl(164_100%_45%/0.25)]">
                <Link to={`/check/${settlement.canonical_key}`}>
                  Check If I Qualify <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqItems.map((faq, i) => (
              <div key={i} className="glass-card">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left text-sm font-medium"
                >
                  {faq.q}
                  {openFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Related Settlements */}
        {related.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Related Settlements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/settlement/${r.canonical_key}`}
                  className="glass-card p-4 hover:border-primary/20 transition-colors"
                >
                  <h3 className="font-semibold text-sm mb-1">{r.name}</h3>
                  <p className="text-xs text-muted-foreground">{r.company} · {r.breach_year}</p>
                  <PayoutRange min={r.payout_min || 0} max={r.payout_max || 0} size="sm" className="mt-2" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Source Links */}
        <div className="flex flex-wrap gap-3 mb-10">
          {settlement.official_source_url && (
            <a href={settlement.official_source_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Official source
            </a>
          )}
          {settlement.claims_filing_url && (
            <a href={settlement.claims_filing_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Official claims filing
            </a>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          BreachPay is not a law firm and does not provide legal advice. Eligibility depends on settlement administrator review. Estimated payouts are subject to settlement terms.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Log In</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 BreachPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default SettlementPublic;
