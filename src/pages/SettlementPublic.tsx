import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PayoutRange } from "@/components/PayoutRange";
import { DeadlineBadge, isDeadlinePassed } from "@/components/DeadlineBadge";
import { VerificationBadge } from "@/components/VerificationBadge";
import logo from "@/assets/logo.png";
import { SettlementTrustBlock } from "@/components/SettlementTrustBlock";
import { SettlementStatusBadge } from "@/components/SettlementStatusBadge";
import { CredibilityBadge } from "@/components/CredibilityBadge";
import {
  ArrowRight, Clock, AlertTriangle, Shield, MapPin, Hash,
  Building2, ExternalLink, HelpCircle, ChevronDown, ChevronUp,
  CheckCircle2, FileText, Lock, Bell, Search,
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
  credibility_score: number | null;
  verification_status: string | null;
  media_references: any;
  verification_sources: any;
}

function buildFaqItems(s: SettlementPublicData) {
  return [
    {
      q: `How do I file a claim for the ${s.company} settlement?`,
      a: "You can file directly through BreachPay's guided claim system. Enter your email, verify your eligibility, and we'll generate your claim packet automatically.",
    },
    {
      q: "How much money will I get?",
      a: `Payouts vary based on the type of data exposed and your documentation. Estimated range for this settlement is $${s.payout_min || 0} – $${s.payout_max || 0}. Final amounts depend on the number of valid claims filed.`,
    },
    {
      q: "Is this settlement legitimate?",
      a: "Yes. This settlement was court-approved and is administered by a certified settlement administrator. BreachPay verifies all settlement data before publishing.",
    },
    {
      q: "Do I need proof to file?",
      a: "Some claims require documentation such as breach notification letters, identity theft reports, or credit monitoring receipts. BreachPay will guide you through what's needed.",
    },
    {
      q: "What happens after I file?",
      a: "Your claim is reviewed by the settlement administrator. If approved, payouts are distributed after the claims period closes. You'll receive status updates throughout the process.",
    },
    {
      q: "Is there a cost to use BreachPay?",
      a: "There are no upfront fees. BreachPay only charges a 15% success fee if your claim is paid out. If you don't get paid, you don't pay.",
    },
    {
      q: `What if I miss the ${s.company} filing deadline?`,
      a: "Late claims are typically not accepted. We strongly recommend filing before the deadline. BreachPay can send you deadline reminders so you don't miss out.",
    },
  ];
}

const SettlementPublic = () => {
  const { slug } = useParams<{ slug: string }>();
  const [settlement, setSettlement] = useState<SettlementPublicData | null>(null);
  const [related, setRelated] = useState<SettlementPublicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchSettlement = async () => {
      const { data } = await supabase
        .from("settlements")
        .select("id, name, company, breach_year, description, eligibility_summary, category, payout_min, payout_max, claim_deadline, deadline, jurisdiction, case_number, administrator_name, official_source_url, claims_filing_url, verified, verification_level, status, tags, canonical_key, credibility_score, verification_status, media_references, verification_sources")
        .eq("verified", true)
        .eq("is_demo", false)
        .eq("is_test", false)
        .or(`canonical_key.eq.${slug},canonical_key.ilike.%${slug}%`);

      const match = data?.[0] as SettlementPublicData | undefined;
      if (match) {
        setSettlement(match);

        const { data: rel } = await supabase
          .from("settlements")
          .select("id, name, company, breach_year, description, eligibility_summary, category, payout_min, payout_max, claim_deadline, deadline, jurisdiction, case_number, administrator_name, official_source_url, claims_filing_url, verified, verification_level, status, tags, canonical_key, credibility_score, verification_status, media_references, verification_sources")
          .eq("verified", true)
          .eq("is_demo", false)
          .eq("is_test", false)
          .neq("id", match.id)
          .or(`company.eq.${match.company},category.eq.${match.category || "none"}`)
          .limit(4);

        setRelated((rel || []) as SettlementPublicData[]);
      }
      setLoading(false);
    };

    fetchSettlement();
  }, [slug]);

  // SEO: title, meta, JSON-LD
  useEffect(() => {
    if (!settlement) return;
    const faqItems = buildFaqItems(settlement);
    const title = `${settlement.company} Data Breach Settlement (${settlement.breach_year || "Recent"}) | BreachPay`;
    document.title = title;

    const desc = `You may be eligible for $${settlement.payout_min || 0} – $${settlement.payout_max || 0} from the ${settlement.company} data breach settlement. Check your eligibility and file your claim before the deadline.`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    } else {
      metaDesc = document.createElement("meta");
      (metaDesc as HTMLMetaElement).name = "description";
      (metaDesc as HTMLMetaElement).content = desc;
      document.head.appendChild(metaDesc);
    }

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
  const isClosed = settlement.status === "closed" || (settlement as any).lifecycle_status === "closed" || (settlement as any).lifecycle_status === "archived" || isDeadlinePassed(effectiveDeadline);
  const faqItems = buildFaqItems(settlement);
  const checkUrl = `/check/${settlement.canonical_key}`;

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

      {/* Urgent Deadline Banner */}
      {isUrgent && !isClosed && daysLeft !== null && (
        <div className="bg-critical/10 border-b border-critical/20 py-3">
          <div className="mx-auto max-w-6xl px-6 flex items-center justify-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-critical" />
            <span className="font-semibold text-critical">⏳ {daysLeft} days left to file your claim</span>
            <span className="text-muted-foreground">— Late claims may not be accepted.</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6">
        {/* ===== SECTION 1: ABOVE THE FOLD (CONVERSION ZONE) ===== */}
        <section className="py-12 sm:py-16">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <SettlementStatusBadge status={settlement.verification_status || "verified"} compact />
            <VerificationBadge level={settlement.verification_level} verified={settlement.verified} compact />
            <CredibilityBadge score={settlement.credibility_score} compact />
            <DeadlineBadge deadline={effectiveDeadline} />
            {settlement.category && (
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">{settlement.category}</span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
            {settlement.company} Data Breach Settlement{settlement.breach_year ? ` (${settlement.breach_year})` : ""}
          </h1>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
            You may be eligible for compensation from the {settlement.company} data breach.
          </p>

          {/* Payout + Deadline Hero Card */}
          <div className="glass-card-glow p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Estimated Compensation</p>
                <PayoutRange min={settlement.payout_min || 0} max={settlement.payout_max || 0} size="lg" />
              </div>
              {effectiveDeadline && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Claim Deadline</p>
                  <div className={`text-lg font-bold ${isUrgent ? "text-critical" : "text-foreground"}`}>
                    {isUrgent && <span>⏳ </span>}
                    {effectiveDeadline}
                  </div>
                  {daysLeft !== null && (
                    <p className={`text-sm ${isUrgent ? "text-critical" : "text-muted-foreground"}`}>
                      {daysLeft} days remaining
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Primary + Secondary CTA */}
          {!isClosed && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-xl shadow-[0_0_24px_hsl(164_100%_45%/0.3)] text-base px-8">
                <Link to={checkUrl}>
                  Check If I Qualify <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-xl text-base px-8">
                <Link to="/scan">
                  <Search className="mr-2 h-4 w-4" /> Run Free Scan
                </Link>
              </Button>
            </div>
          )}
          {isClosed && (
            <div className="glass-card p-4 flex items-center gap-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              <p className="text-muted-foreground">
                The filing deadline for this settlement has passed. <Link to="/scan" className="text-primary hover:underline">Run a free scan</Link> to find other settlements you may qualify for.
              </p>
            </div>
          )}
        </section>

        {/* ===== SECTION 2: SETTLEMENT OVERVIEW ===== */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Settlement Overview
          </h2>
          <div className="glass-card p-6 space-y-6">
            {/* What Happened */}
            <div>
              <h3 className="font-semibold mb-2">What happened?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {settlement.description ||
                  `In ${settlement.breach_year || "recent years"}, ${settlement.company} experienced a significant data breach that exposed personal information of its users and customers.`}
              </p>
            </div>

            {/* Who Was Affected */}
            <div>
              <h3 className="font-semibold mb-2">Who was affected?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Individuals whose personal data — including email addresses, phone numbers, Social Security numbers, and other sensitive information — was exposed during the {settlement.company} breach
                {settlement.breach_year ? ` in ${settlement.breach_year}` : ""}.
              </p>
            </div>

            {/* What Is This Settlement */}
            <div>
              <h3 className="font-semibold mb-2">What is this settlement about?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {settlement.eligibility_summary ||
                  `This court-approved settlement provides compensation to affected individuals for damages resulting from the data breach, including identity theft, fraud losses, and out-of-pocket expenses.`}
              </p>
            </div>

            {/* Quick Facts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border text-sm">
              {settlement.breach_year && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Breach Year:</span>
                  <span className="font-medium">{settlement.breach_year}</span>
                </div>
              )}
              {settlement.jurisdiction && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Jurisdiction:</span>
                  <span className="font-medium">{settlement.jurisdiction}</span>
                </div>
              )}
              {settlement.case_number && (
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Case:</span>
                  <span className="font-medium">{settlement.case_number}</span>
                </div>
              )}
              {settlement.administrator_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Administrator:</span>
                  <span className="font-medium">{settlement.administrator_name}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===== SECTION 3: AM I ELIGIBLE? ===== */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-5">Am I Eligible?</h2>
          <div className="glass-card p-6">
            <ul className="space-y-3 text-sm">
              {settlement.breach_year && (
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>You had a {settlement.company} account in {settlement.breach_year}</span>
                </li>
              )}
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Your personal data (email, phone, SSN, etc.) was exposed in the breach</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>You received a breach notification from {settlement.company}</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>You experienced fraud, identity theft, or spent time dealing with the breach</span>
              </li>
              {settlement.category && (
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>This settlement covers <strong>{settlement.category}</strong> related claims</span>
                </li>
              )}
            </ul>

            {!isClosed && (
              <Button asChild className="mt-6 rounded-xl" size="lg">
                <Link to={checkUrl}>
                  Check My Eligibility <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* ===== SECTION 4: PAYOUT DETAILS ===== */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-5">How Much Could I Receive?</h2>
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 bg-muted/50 rounded-xl p-5 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Minimum Payout</p>
                <p className="text-2xl font-bold text-primary">${settlement.payout_min || 0}</p>
              </div>
              <div className="flex-1 bg-muted/50 rounded-xl p-5 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Maximum Payout</p>
                <p className="text-2xl font-bold text-primary">${settlement.payout_max || 0}</p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>Additional reimbursement may be available for:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Out-of-pocket expenses related to the breach</li>
                <li>Identity theft losses and fraud charges</li>
                <li>Credit monitoring and protection costs</li>
                <li>Time spent dealing with breach-related issues</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              Final amounts depend on claim validation, the number of eligible claimants, and settlement distribution terms.
            </p>
          </div>
        </section>

        {/* ===== SECTION 5: DEADLINE URGENCY ===== */}
        {effectiveDeadline && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Filing Deadline
            </h2>
            <div className={`glass-card p-6 text-center ${isUrgent && !isClosed ? "border-critical/30" : ""}`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Deadline to File</p>
              <p className={`text-3xl font-bold mb-2 ${isUrgent && !isClosed ? "text-critical" : "text-foreground"}`}>
                {effectiveDeadline}
              </p>

              {daysLeft !== null && !isClosed && (
                <>
                  {/* Countdown display */}
                  <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold mb-4 ${
                    isUrgent ? "bg-critical/10 text-critical" : "bg-muted text-foreground"
                  }`}>
                    {isUrgent && <AlertTriangle className="h-4 w-4" />}
                    ⏳ {daysLeft} days remaining
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    Late claims may not be accepted. Don't miss your deadline.
                  </p>
                  <Button asChild size="lg" className="rounded-xl shadow-[0_0_24px_hsl(164_100%_45%/0.3)]">
                    <Link to={checkUrl}>
                      Start My Claim <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}

              {isClosed && (
                <p className="text-sm text-warning mt-2">This filing deadline has passed.</p>
              )}
            </div>
          </section>
        )}

        {/* ===== SECTION 6: HOW BREACHPAY HELPS ===== */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-5">How BreachPay Helps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Search, title: "Automated Eligibility Checks", desc: "Instantly check if your data was exposed in this breach." },
              { icon: FileText, title: "Claim Packet Generation", desc: "We compile and format your claim documentation automatically." },
              { icon: Lock, title: "Secure Document Vault", desc: "Store sensitive evidence safely with encrypted storage." },
              { icon: Bell, title: "Settlement Monitoring Alerts", desc: "Get notified about status updates and new deadlines." },
            ].map((item) => (
              <div key={item.title} className="glass-card p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {!isClosed && (
            <div className="mt-6 text-center">
              <Button asChild variant="outline" size="lg" className="rounded-xl">
                <Link to="/scan">
                  <Search className="mr-2 h-4 w-4" /> Run My Free Scan
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* ===== TRUST & VERIFICATION BLOCK (Step 12) ===== */}
        <section className="mb-12">
          <SettlementTrustBlock
            credibilityScore={settlement.credibility_score}
            verificationLevel={settlement.verification_level}
            verificationSources={Array.isArray(settlement.verification_sources) ? settlement.verification_sources : []}
            mediaReferences={Array.isArray(settlement.media_references) ? settlement.media_references : []}
            verificationStatus={settlement.verification_status || "verified"}
            administratorName={settlement.administrator_name}
          />
        </section>


        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqItems.map((faq, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left text-sm font-medium hover:bg-muted/30 transition-colors"
                >
                  {faq.q}
                  {openFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ===== SECTION 8: INTERNAL LINKING ===== */}
        {related.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-5">Related Settlements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/settlement/${r.canonical_key}`}
                  className="glass-card p-5 hover:border-primary/20 transition-colors group"
                >
                  <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{r.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{r.company} · {r.breach_year || "Recent"}</p>
                  <PayoutRange min={r.payout_min || 0} max={r.payout_max || 0} size="sm" />
                  {(r.claim_deadline || r.deadline) && (
                    <p className="text-xs text-muted-foreground mt-2">Deadline: {r.claim_deadline || r.deadline}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Source links */}
        <div className="flex flex-wrap gap-4 mb-10">
          {settlement.official_source_url && (
            <a href={settlement.official_source_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Official source
            </a>
          )}
          {settlement.claims_filing_url && (
            <a href={settlement.claims_filing_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Official claims filing
            </a>
          )}
        </div>

        {/* Final CTA */}
        {!isClosed && (
          <section className="mb-12">
            <div className="glass-card-glow p-8 sm:p-10 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Don't Miss Your Chance</h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                Find out in minutes if you're owed money from the {settlement.company} data breach.
                No upfront fees — we only get paid if you do.
              </p>
              <Button asChild size="lg" className="rounded-xl shadow-[0_0_24px_hsl(164_100%_45%/0.3)] text-base px-8">
                <Link to={checkUrl}>
                  Check If I Qualify <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}

        <p className="text-[11px] text-muted-foreground pb-8">
          BreachPay is not a law firm and does not provide legal advice. Eligibility is determined by the settlement administrator. Estimated payouts are subject to settlement terms and the number of valid claims filed.
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
