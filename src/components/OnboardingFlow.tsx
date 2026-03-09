import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Mail, Phone, Search, ArrowRight, Plus, X, Loader2, CheckCircle, Shield, Crown } from "lucide-react";
import { ScanProgressSteps } from "@/components/ScanProgressSteps";

interface Props {
  onComplete: () => void;
}

const FREE_EMAIL_LIMIT = 2;
const PREMIUM_EMAIL_LIMIT = 5;

export function OnboardingFlow({ onComplete }: Props) {
  const { user, plan } = useAuth();
  const track = useTrackEvent();
  const [step, setStep] = useState(1);
  const [secondaryEmails, setSecondaryEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [scanRunId, setScanRunId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ breaches: number; estimatedValue: number } | null>(null);

  const primaryEmail = user?.email || "";
  const isPremium = plan === "premium";
  const emailLimit = isPremium ? PREMIUM_EMAIL_LIMIT : FREE_EMAIL_LIMIT;
  const canAddMore = secondaryEmails.length < emailLimit;

  const addSecondaryEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!canAddMore) return;
    if (trimmed && trimmed !== primaryEmail && !secondaryEmails.includes(trimmed) && /\S+@\S+\.\S+/.test(trimmed)) {
      setSecondaryEmails([...secondaryEmails, trimmed]);
      setNewEmail("");
    }
  };

  const removeEmail = (email: string) => {
    setSecondaryEmails(secondaryEmails.filter(e => e !== email));
  };

  // Poll for scan completion
  useEffect(() => {
    if (!scanning || !scanRunId || !user) return;

    const interval = setInterval(async () => {
      const { data: scan } = await supabase
        .from("scan_runs")
        .select("status, risk_score, breaches_detected, eligible_settlements")
        .eq("id", scanRunId)
        .maybeSingle();

      if (scan && (scan.status === "completed" || scan.status === "failed")) {
        clearInterval(interval);

        if (scan.status === "failed") {
          toast({ title: "Scan Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
          setScanning(false);
          return;
        }

        // Fetch settlement matches for estimated value
        const { data: matches } = await supabase
          .from("settlement_matches")
          .select("payout_estimate, confidence_level, settlements(payout_max)")
          .eq("user_id", user.id);

        const estimatedValue = (matches || []).reduce((sum: number, m: any) => sum + (m.settlements?.payout_max || 0), 0);

        setScanResult({
          breaches: scan.breaches_detected || 0,
          estimatedValue,
        });

        track("scan_completed", { scan_id: scanRunId, breaches: scan.breaches_detected || 0, source: "onboarding" });
        setScanDone(true);
        setScanning(false);

        // Mark onboarding complete
        await supabase
          .from("user_profiles")
          .update({ onboarding_completed: true })
          .eq("user_id", user.id);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [scanning, scanRunId, user]);

  const handleRunScan = async () => {
    if (!user) return;
    setScanning(true);
    try {
      track("scan_started", { source: "onboarding" });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      // Call the real hibp-scan edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/hibp-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.status === 429) {
        toast({ title: "Rate Limited", description: "Please wait a moment and try again.", variant: "destructive" });
        setScanning(false);
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setScanRunId(result.scan_run_id);
      // Polling will handle the rest via useEffect
    } catch (e: any) {
      toast({ title: "Scan Error", description: e.message, variant: "destructive" });
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-lg px-4">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="BreachPay" className="h-10 drop-shadow-[0_0_20px_hsl(164_100%_45%/0.2)]" />
        </div>

        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-10 bg-primary" : s < step ? "w-10 bg-primary/40" : "w-10 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Emails */}
        {step === 1 && (
          <div className="glass-card p-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Let's protect your identity</h2>
              <p className="mt-2 text-sm text-muted-foreground">We'll scan breach databases for these emails</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Primary Email</label>
                <Input value={primaryEmail} disabled className="rounded-xl bg-muted/50 mt-1" />
              </div>

              {secondaryEmails.map(email => (
                <div key={email} className="flex items-center gap-2">
                  <Input value={email} disabled className="rounded-xl bg-muted/50 flex-1" />
                  <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => removeEmail(email)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {canAddMore ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="Add another email (optional)"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSecondaryEmail())}
                    className="rounded-xl flex-1"
                  />
                  <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 rounded-xl" onClick={addSecondaryEmail}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              {/* Email limit indicator */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {secondaryEmails.length}/{emailLimit} additional emails
                </p>
                {!isPremium && secondaryEmails.length >= emailLimit && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Crown className="h-3 w-3" />
                    <span>Upgrade for up to {PREMIUM_EMAIL_LIMIT} emails</span>
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full rounded-xl" onClick={() => setStep(2)}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Phone */}
        {step === 2 && (
          <div className="glass-card p-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Add phone number</h2>
              <p className="mt-2 text-sm text-muted-foreground">Some settlements are tied to phone exposure. Adding this improves your match accuracy.</p>
            </div>

            <div>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button className="flex-1 rounded-xl" onClick={() => setStep(3)}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Run Scan */}
        {step === 3 && !scanDone && !scanning && (
          <div className="glass-card p-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Check if you're owed money</h2>
              <p className="mt-2 text-sm text-muted-foreground">We'll scan thousands of known data breaches and active class-action settlements to find your matches.</p>
            </div>

            <div className="rounded-xl bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Scanning {1 + secondaryEmails.length} email{secondaryEmails.length > 0 ? "s" : ""}</span>
              </div>
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>Scanning phone number</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>Cross-referencing settlement databases</span>
              </div>
            </div>

            <Button
              className="w-full rounded-xl text-base h-12 gradient-emerald text-primary-foreground font-semibold"
              onClick={handleRunScan}
            >
              Check If I'm Owed Money
            </Button>
          </div>
        )}

        {/* Step 3: Scanning in progress */}
        {step === 3 && scanning && !scanDone && (
          <ScanProgressSteps />
        )}

        {/* Step 3: Results */}
        {step === 3 && scanDone && scanResult && (
          <div className="glass-card-glow p-8 space-y-6">
            <div className="text-center">
              {scanResult.breaches > 0 ? (
                <>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-emerald">
                    <Shield className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    You may be eligible for up to{" "}
                    <span className="gradient-emerald-text">${scanResult.estimatedValue.toLocaleString()}</span>
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We found {scanResult.breaches} potential match{scanResult.breaches !== 1 ? "es" : ""} in settlement databases
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold">No matches yet</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We'll keep monitoring and alert you when new settlements appear
                  </p>
                </>
              )}
            </div>

            <Button
              className="w-full rounded-xl text-base h-12"
              onClick={onComplete}
            >
              {scanResult.breaches > 0 ? "View My Matches" : "Go to Dashboard"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
