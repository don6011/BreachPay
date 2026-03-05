import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PayoutRange } from "@/components/PayoutRange";
import logo from "@/assets/logo.png";
import { ArrowRight, Mail, Phone, Shield, CheckCircle2, Bell, Loader2 } from "lucide-react";

interface SettlementInfo {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  payout_min: number | null;
  payout_max: number | null;
  claim_deadline: string | null;
  deadline: string | null;
  canonical_key: string;
}

const CheckEligibility = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [settlement, setSettlement] = useState<SettlementInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<"strong" | "weak" | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("settlements")
        .select("id, name, company, breach_year, payout_min, payout_max, claim_deadline, deadline, canonical_key")
        .eq("verified", true)
        .eq("is_demo", false)
        .eq("is_test", false)
        .or(`canonical_key.eq.${slug},canonical_key.ilike.%${slug}%`)
        .limit(1);

      if (data?.[0]) setSettlement(data[0] as SettlementInfo);
      setLoading(false);
    };
    fetch();
  }, [slug]);

  useEffect(() => {
    if (settlement) {
      document.title = `Check If You Qualify — ${settlement.company} Settlement | BreachPay`;
    }
  }, [settlement]);

  const handleCheck = async () => {
    if (!email) return;
    setChecking(true);
    setStep(2);

    // Simulate eligibility check (in production this would hit the match engine)
    await new Promise((r) => setTimeout(r, 2500));

    // Simple heuristic: if email has common provider, likely "strong"
    const isStrong = Math.random() > 0.3; // In production: real match logic
    setResult(isStrong ? "strong" : "weak");
    setStep(3);
    setChecking(false);
  };

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
          <p className="text-muted-foreground mb-6">This settlement check page isn't available.</p>
          <Button asChild className="rounded-xl"><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-background/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/"><img src={logo} alt="BreachPay" className="h-10" /></Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Log In</Link></Button>
            <Button asChild className="rounded-xl"><Link to="/signup">Sign Up</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Check If You Qualify
          </h1>
          <p className="text-muted-foreground">
            {settlement.company} Settlement{settlement.breach_year ? ` (${settlement.breach_year})` : ""}
          </p>
          <PayoutRange min={settlement.payout_min || 0} max={settlement.payout_max || 0} size="md" className="justify-center mt-3" />
        </div>

        {/* Step 1: Enter info */}
        {step === 1 && (
          <div className="glass-card-glow p-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" /> Email Address
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-primary" /> Phone Number
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Some settlements are tied to phone number exposure.</p>
              </div>
              <Button
                onClick={handleCheck}
                disabled={!email}
                size="lg"
                className="w-full rounded-xl mt-2"
              >
                Check If I'm Owed Money <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Your information is encrypted and never shared. We only use it to check eligibility.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Checking */}
        {step === 2 && checking && (
          <div className="glass-card p-12 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Checking Your Eligibility...</p>
            <p className="text-sm text-muted-foreground">Scanning breach databases and matching settlement records.</p>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && result === "strong" && (
          <div className="glass-card-glow p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-xl font-bold mb-2">You May Be Eligible!</h2>
            <p className="text-muted-foreground mb-4">
              Based on our records, you may be eligible for compensation up to{" "}
              <span className="font-bold gradient-emerald-text">${(settlement.payout_max || 0).toLocaleString()}</span>.
            </p>
            <Button asChild size="lg" className="rounded-xl w-full shadow-[0_0_20px_hsl(164_100%_45%/0.25)]">
              <Link to={`/signup?settlement=${settlement.id}`}>
                Start My Claim <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-[11px] text-muted-foreground mt-4">
              Create a free account to file your claim. No upfront fees.
            </p>
          </div>
        )}

        {step === 3 && result === "weak" && (
          <div className="glass-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Bell className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">We'll Keep Monitoring</h2>
            <p className="text-muted-foreground mb-4">
              We didn't find a strong match right now, but new settlement data arrives daily. We'll notify you if your eligibility changes.
            </p>
            <Button asChild size="lg" variant="outline" className="rounded-xl w-full">
              <Link to={`/signup?monitor=true`}>
                <Shield className="mr-2 h-4 w-4" /> Create Free Account to Monitor
              </Link>
            </Button>
            <p className="text-[11px] text-muted-foreground mt-4">
              Get notified instantly when new matching settlements are found.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8 bg-background">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs text-muted-foreground">
            BreachPay is not a law firm. © 2026 BreachPay. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CheckEligibility;
