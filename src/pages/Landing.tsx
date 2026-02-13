import { Button } from "@/components/ui/button";
import { Database, DollarSign, Users, Radio, ArrowRight, Shield, Search, FileText } from "lucide-react";
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

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="BreachPay" className="h-8" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Log In</Link></Button>
            <Button asChild><Link to="/scan">Start Free Scan</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your Data Was Breached.{" "}
            <span className="text-primary">You Could Be Owed Money.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            BreachPay scans thousands of breach databases, matches you to eligible settlements, and helps you file claims — all in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/scan">Start Free Scan <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border/50 bg-card/50">
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
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-lg border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-[0_0_15px_0_hsl(164_100%_42%/0.08)]">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="mb-1 text-xs font-bold text-primary">STEP {i + 1}</div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-muted-foreground space-y-1">
          <p>BreachPay is not a law firm and does not provide legal advice.</p>
          <p>We help users identify eligible settlement claims and track deadlines.</p>
          <p>Data may be sourced from third-party providers and may be incomplete.</p>
          <p className="pt-2">© 2026 BreachPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
