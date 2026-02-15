import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, DollarSign, Users, Radio, ArrowRight, Shield, Search, FileText, Check, Crown, Lock, LogOut, Zap, AlertTriangle, TrendingUp } from "lucide-react";
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

const breachTickerItems = [
  { company: "National Health Corp", records: "14.2M", date: "Feb 2026" },
  { company: "StreamVault", records: "8.7M", date: "Jan 2026" },
  { company: "PayLink Financial", records: "3.1M", date: "Jan 2026" },
  { company: "CloudSync Pro", records: "22M", date: "Dec 2025" },
  { company: "TravelEase", records: "5.4M", date: "Dec 2025" },
  { company: "RetailMax", records: "11.8M", date: "Nov 2025" },
  { company: "FinSecure Bank", records: "2.9M", date: "Nov 2025" },
  { company: "EduConnect", records: "7.6M", date: "Oct 2025" },
];

const urgencyStats = [
  { value: "847", label: "Active Breaches This Month", icon: AlertTriangle, color: "text-critical" },
  { value: "$18.2M", label: "Unclaimed Settlement Funds", icon: DollarSign, color: "text-primary" },
  { value: "23", label: "Deadlines Closing This Week", icon: TrendingUp, color: "text-warning" },
];

const Landing = () => {
  const [calcBreaches, setCalcBreaches] = useState("3");
  const calcMin = parseInt(calcBreaches || "0") * 75;
  const calcMax = parseInt(calcBreaches || "0") * 5000;

  const [tickerOffset, setTickerOffset] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerOffset((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentBreach = breachTickerItems[tickerOffset % breachTickerItems.length];

  return (
    <div className="min-h-screen bg-background">
      {/* Breach Ticker */}
      <div className="border-b border-border/50 bg-destructive/5 py-2">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            <span className="font-semibold text-destructive">LIVE</span>
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{currentBreach.company}</span> breach — {currentBreach.records} records exposed · {currentBreach.date}
          </span>
        </div>
      </div>

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
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img src={logo} alt="BreachPay" className="h-24 sm:h-28 lg:h-32 w-auto drop-shadow-[0_0_30px_hsl(172_89%_52%/0.25)]" />
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your Data Was Breached.{" "}
            <span className="bg-gradient-to-r from-primary to-[hsl(172_60%_70%)] bg-clip-text text-transparent">
              You Could Be Owed Money.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            BreachPay scans thousands of breach databases, matches you to eligible settlements, and helps you file claims — all in one place.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground/60 tracking-wide">
            Encrypted identity scan • No credit impact • Results in seconds
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="rounded-xl bg-primary text-primary-foreground font-semibold shadow-[0_0_20px_hsl(172_89%_52%/0.25)] hover:shadow-[0_0_32px_hsl(172_89%_52%/0.4)] transition-all duration-500"
            >
              <Link to="/scan">Start Free Scan <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="rounded-xl border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-300">
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
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

          <p className="mt-6 text-xs text-muted-foreground/50">
            Scanning 12,000+ verified breach and settlement databases.
          </p>
        </div>
      </section>

      {/* Urgency Breach Stats */}
      <section className="border-y border-destructive/10 bg-destructive/[0.03]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 py-8 sm:grid-cols-3">
          {urgencyStats.map((s) => (
            <div key={s.label} className="glass-card flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border bg-card/50">
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

      {/* Trust Badge Row */}
      <section className="py-8 bg-background">
        <div className="mx-auto max-w-4xl px-6 flex flex-wrap items-center justify-center gap-6">
          {[
            { icon: Shield, text: "SOC 2 Compliant" },
            { icon: Lock, text: "256-bit AES Encryption" },
            { icon: Check, text: "GDPR & CCPA Ready" },
            { icon: Shield, text: "Zero Data Selling" },
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-sm text-muted-foreground">
              <badge.icon className="h-4 w-4 text-primary" />
              {badge.text}
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
                className="glass-card p-6 text-center transition-all duration-300 hover:border-primary/20 hover:shadow-[0_0_20px_0_hsl(172_89%_52%/0.06)]"
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

      {/* Settlement Calculator */}
      <section className="py-16 bg-background border-t border-border">
        <div className="mx-auto max-w-xl px-6">
          <h2 className="mb-2 text-center text-3xl font-bold">Estimate Your Payout</h2>
          <p className="mb-8 text-center text-muted-foreground">See how much you could recover from data breach settlements.</p>
          <div className="glass-card-glow p-8">
            <label className="block text-sm font-medium mb-2">How many breaches have affected you?</label>
            <Input
              type="number"
              min="1"
              max="20"
              value={calcBreaches}
              onChange={(e) => setCalcBreaches(e.target.value)}
              className="rounded-xl text-center text-lg font-bold mb-6"
            />
            <div className="rounded-xl bg-muted/50 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-1">Estimated Recovery Range</p>
              <p className="text-3xl font-bold text-primary drop-shadow-[0_0_10px_hsl(172_89%_52%/0.3)]">
                ${calcMin.toLocaleString()} – ${calcMax.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Based on average settlement payouts</p>
            </div>
            <Button
              asChild
              size="lg"
              className="w-full mt-6 rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300"
            >
              <Link to="/scan">Scan Now — It's Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
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
                className={`relative p-8 transition-all duration-300 ${
                  plan.highlighted ? "glass-card-glow" : "glass-card"
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
