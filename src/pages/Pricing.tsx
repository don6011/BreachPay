import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Crown, ArrowRight, ChevronDown, Zap, FileCheck, ShieldCheck, Shield, CreditCard } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import logo from "@/assets/logo.png";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Get started with basic breach scanning",
    cta: "Start Free Scan",
    ctaLink: "/signup",
    highlighted: false,
    features: [
      "1 secure scan (manual)",
      "Weekly monitoring scans",
      "Breach exposure summary",
      "Standard settlement matching",
      "14-day deadline alerts",
      "Email alerts (batched)",
      "Free claim filing — always",
    ],
  },
  {
    name: "Premium",
    price: "$4.99",
    period: "/mo",
    description: "Real-time monitoring & priority matching",
    cta: "Upgrade to Premium",
    ctaLink: "/signup",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Monitor up to 5 emails",
      "Daily monitoring scans",
      "Real-time breach alerts",
      "Dark web exposure monitoring",
      "Identity risk scoring dashboard",
      "30-day deadline alerts",
      "Priority settlement matching",
      "Auto-claim packet generation",
      "Risk trend history + score changes",
    ],
  },
];

const comparisonRows = [
  { feature: "Monitored emails", free: "1", premium: "Up to 5" },
  { feature: "Scan frequency", free: "Weekly", premium: "Daily" },
  { feature: "Breach alerts", free: "Batched", premium: "Real-time" },
  { feature: "Dark web monitoring", free: "—", premium: "✓" },
  { feature: "Deadline alerts window", free: "14 days", premium: "30 days" },
  { feature: "Settlement matching", free: "Standard", premium: "Priority" },
  { feature: "Identity risk scoring", free: "—", premium: "✓" },
  { feature: "Auto-claim packets", free: "—", premium: "✓" },
  { feature: "Risk history", free: "—", premium: "✓" },
  { feature: "Support", free: "Standard", premium: "Priority" },
];

const faqs = [
  {
    q: "How does BreachPay find my breaches?",
    a: "We scan over 12,000 known breach databases using your email address to identify which data breaches exposed your information.",
  },
  {
    q: "What's included in the Free plan?",
    a: "The Free plan includes one manual scan, weekly monitoring, breach exposure summaries, standard settlement matching, and batched email alerts.",
  },
  {
    q: "Can I cancel Premium anytime?",
    a: "Yes, you can cancel your Premium subscription at any time. There are no long-term commitments or cancellation fees.",
  },
  {
    q: "How do payouts work?",
    a: "Once your claim is approved through a class action settlement, payouts are sent directly to you. BreachPay takes a small processing fee only on successful claims.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use bank-grade encryption and never store your raw personal data. All scans are performed using hashed identifiers.",
  },
];

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-background/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/"><img src={logo} alt="BreachPay" className="h-10" /></Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/signup">Start Free Scan</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(164 100% 45% / 0.07) 0%, hsl(172 100% 37% / 0.03) 40%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple pricing.{" "}
            <span className="text-primary">Real protection.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Start for free. Upgrade when you need daily scans, instant alerts, and priority matching.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 transition-all duration-300 ${
                  plan.highlighted
                    ? "border-primary/30 bg-card shadow-[0_0_30px_0_hsl(164_100%_45%/0.08)]"
                    : "border-border bg-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-emerald px-4 py-1 text-xs font-bold text-primary-foreground">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                {plan.highlighted && (
                  <p className="mt-1 text-xs text-muted-foreground">Cancel anytime</p>
                )}
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.highlighted ? "default" : "secondary"}
                  className="mt-8 w-full rounded-xl"
                >
                  <Link to={plan.ctaLink}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold">Compare Plans</h2>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-6 py-4 text-center font-medium text-muted-foreground">Free</th>
                  <th className="px-6 py-4 text-center font-medium text-primary">Premium</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-b last:border-0">
                    <td className="px-6 py-3.5 font-medium">{row.feature}</td>
                    <td className="px-6 py-3.5 text-center text-muted-foreground">{row.free}</td>
                    <td className="px-6 py-3.5 text-center">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Claim Acceleration Services */}
      <section className="pb-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-2 text-center text-2xl font-bold">Claim Acceleration</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">Optional add-ons to speed up your payout. Claims are always free to file.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Zap, title: "Expedited Review", desc: "Priority processing within 48 hours", price: "$9" },
              { icon: FileCheck, title: "Document Verification", desc: "Expert review of your evidence", price: "$14" },
              { icon: ShieldCheck, title: "Eligibility Appeal", desc: "Professional appeal if denied", price: "$29" },
            ].map(({ icon: Icon, title, desc, price }) => (
              <div key={title} className="rounded-2xl border bg-card p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{desc}</p>
                <p className="text-2xl font-bold">{price}</p>
                <p className="text-xs text-muted-foreground">one-time</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Identity Protection */}
      <section className="pb-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-2 text-center text-2xl font-bold">Identity Protection</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">Ongoing protection from our trusted partners</p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: CreditCard, title: "Credit Monitoring", desc: "Alerts on credit changes & new accounts" },
              { icon: Shield, title: "Identity Insurance", desc: "Up to $1M theft coverage" },
              { icon: Crown, title: "Restoration Service", desc: "Dedicated identity restoration specialist" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-card p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
                <p className="mt-3 text-xs text-muted-foreground">Partner offer</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-2xl border bg-card px-6">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border py-16 bg-card">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to protect your identity?</h2>
          <p className="text-muted-foreground mb-8">Scan for breaches in seconds. No credit card required.</p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild className="rounded-xl">
              <Link to="/signup">Start Free Scan <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="rounded-xl">
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-muted-foreground space-y-1">
          <p>BreachPay is not a law firm and does not provide legal advice.</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
          <p>© 2026 BreachPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
