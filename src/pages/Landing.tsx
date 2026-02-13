import { Button } from "@/components/ui/button";
import { Database, DollarSign, Users, Radio, ArrowRight, Shield, Search, FileText, Check, Crown, Lock, LogOut, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const stats = [
  { icon: Database, value: "12,000+", label: "Databases Scanned" },
  { icon: DollarSign, value: "$2.4M+", label: "Settlements Tracked" },
  { icon: Users, value: "50,000+", label: "Identities Protected" },
  { icon: Radio, value: "Daily", label: "Breach Detection" },
];

const steps = [
  { icon: Search, title: "Scan Your Identity", description: "Enter your email to scan 12,000+ breach databases in seconds." },
  { icon: Shield, title: "Discover Exposures", description: "See which breaches exposed your data and your risk severity." },
  { icon: FileText, title: "Match Settlements", description: "We automatically match you to eligible class action settlements." },
  { icon: DollarSign, title: "File & Get Paid", description: "File claims with one click and track payouts through your wallet." },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Get started with basic breach scanning",
    cta: "Start Free Scan",
    ctaLink: "/scan",
    highlighted: false,
    features: [
      "1 secure scan (manual)",
      "Weekly monitoring scans",
      "Breach exposure summary",
      "Standard settlement matching",
      "14-day deadline alerts",
      "Email alerts (batched)",
    ],
  },
  {
    name: "Premium",
    price: "$9.99",
    period: "/mo",
    description: "Advanced monitoring and priority matching",
    cta: "Upgrade to Premium",
    ctaLink: "/signup",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Daily monitoring scans",
      "Instant email alerts",
      "30-day deadline alerts",
      "Priority settlement matching",
      "Risk trend history + score changes",
      "Priority support",
    ],
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <img src={logo} alt="BreachPay" className="h-10" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300">
              <Link to="/scan">Start Free Scan</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(172 89% 52% / 0.07) 0%, hsl(172 84% 39% / 0.03) 40%, transparent 70%)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(172 89% 52% / 0.05) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-8 flex justify-center">
            <img src={logo} alt="BreachPay" className="h-20 sm:h-24 lg:h-28" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your Data Was Breached.{" "}
            <span className="text-primary">You Could Be Owed Money.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            BreachPay scans thousands of breach databases, matches you to eligible settlements, and helps you file claims — all in one place.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground/70">
            Scanning 12,000+ verified breach databases.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="rounded-xl bg-primary text-primary-foreground font-semibold hover:shadow-[0_0_24px_hsl(172_89%_52%/0.3)] transition-all duration-300"
            >
              <Link to="/scan">Start Free Scan <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="rounded-xl border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-300">
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span>No upfront claim fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span>Bank-level encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center">
              <s.icon className="mb-2 h-6 w-6 text-primary" />
              <span className="text-2xl font-bold">{s.value}</span>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-background">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border p-6 text-center bg-card transition-all duration-300 hover:border-primary/20 hover:shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)]"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">STEP {i + 1}</div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-background border-t border-border">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-3 text-center text-3xl font-bold">Pricing</h2>
          <p className="mb-12 text-center text-muted-foreground">Start for free. Upgrade when you need more.</p>
          <div className="grid gap-6 md:grid-cols-2">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 transition-all duration-300 ${
                  plan.highlighted
                    ? "border-primary/30 bg-card shadow-[0_0_30px_0_hsl(172_89%_52%/0.08)]"
                    : "border-border bg-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
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
                  className={`mt-8 w-full rounded-xl transition-all duration-300 ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)]"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Link to={plan.ctaLink}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            BreachPay is not a law firm and does not provide legal advice.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Log In</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>BreachPay is not a law firm and does not provide legal advice.</p>
            <p>We help users identify eligible settlement claims and track deadlines.</p>
            <p>Data may be sourced from third-party providers and may be incomplete.</p>
            <p className="pt-2">© 2026 BreachPay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
