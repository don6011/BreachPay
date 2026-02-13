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
    <div className="min-h-screen" style={{ background: '#05070A' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(5,7,10,0.85)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="BreachPay" className="h-8" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-white/70 hover:text-white hover:bg-white/5">
              <Link to="/login">Log In</Link>
            </Button>
            <Button
              asChild
              className="relative border border-[#14F1D9]/30 bg-[#14F1D9]/10 text-[#14F1D9] backdrop-blur-sm hover:bg-[#18FFE4]/20 hover:border-[#18FFE4]/50 hover:shadow-[0_0_20px_rgba(20,241,217,0.25)] transition-all duration-300"
            >
              <Link to="/scan">Start Free Scan</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Background gradient - dark teal to cyan glow */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(20,241,217,0.08) 0%, rgba(12,198,184,0.03) 40%, transparent 70%)',
          }}
        />
        {/* Subtle radial glow behind headline */}
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(20,241,217,0.06) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-white">
            Your Data Was Breached.{" "}
            <span style={{ color: '#14F1D9' }}>You Could Be Owed Money.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50">
            BreachPay scans thousands of breach databases, matches you to eligible settlements, and helps you file claims — all in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="relative border border-[#14F1D9]/30 bg-[#14F1D9]/10 text-[#14F1D9] backdrop-blur-sm hover:bg-[#18FFE4]/20 hover:border-[#18FFE4]/50 hover:shadow-[0_0_24px_rgba(20,241,217,0.3)] transition-all duration-300 font-semibold"
            >
              <Link to="/scan">Start Free Scan <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-300">
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/5" style={{ background: '#0B0F14' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center">
              <s.icon className="mb-2 h-6 w-6" style={{ color: '#14F1D9' }} />
              <span className="text-2xl font-bold text-white">{s.value}</span>
              <span className="text-sm text-white/40">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20" style={{ background: '#05070A' }}>
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-lg border border-white/5 p-6 text-center transition-all duration-300 hover:border-[#14F1D9]/20 hover:shadow-[0_0_20px_0_rgba(20,241,217,0.06)]"
                style={{ background: '#0B0F14' }}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(20,241,217,0.08)' }}>
                  <step.icon className="h-5 w-5" style={{ color: '#14F1D9' }} />
                </div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: '#14F1D9' }}>STEP {i + 1}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-white/40">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8" style={{ background: '#05070A' }}>
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-white/30 space-y-1">
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
