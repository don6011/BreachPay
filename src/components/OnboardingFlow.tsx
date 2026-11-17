import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { toast } from "@/hooks/use-toast";

interface Props {
  onComplete: () => void;
}

interface Result {
  breaches: number;
  matches: number;
}

/**
 * First-run screen: offers one breach check for the account's own email
 * address. It can always be skipped, so a failed lookup never locks anyone out.
 */
export function OnboardingFlow({ onComplete }: Props) {
  const { user, signOut } = useAuth();
  const track = useTrackEvent();
  const [scanning, setScanning] = useState(false);
  const [scanRunId, setScanRunId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  const email = user?.email ?? "";

  const markDone = async () => {
    if (!user) return;
    await supabase.from("user_profiles").update({ onboarding_completed: true }).eq("user_id", user.id);
  };

  // Wait for the check to finish, then read back what it found.
  useEffect(() => {
    if (!scanning || !scanRunId || !user) return;

    const interval = setInterval(async () => {
      const { data: scan } = await supabase
        .from("scan_runs")
        .select("status, breaches_detected, eligible_settlements")
        .eq("id", scanRunId)
        .maybeSingle();

      if (!scan || (scan.status !== "completed" && scan.status !== "failed")) return;
      clearInterval(interval);
      setScanning(false);

      if (scan.status === "failed") {
        setFailed(true);
        return;
      }

      setResult({ breaches: scan.breaches_detected || 0, matches: scan.eligible_settlements || 0 });
      track("scan_completed", { scan_id: scanRunId, breaches: scan.breaches_detected || 0, source: "onboarding" });
      await markDone();
    }, 2000);

    return () => clearInterval(interval);
    // markDone and track are stable for the lifetime of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, scanRunId, user]);

  const runCheck = async () => {
    if (!user) return;
    setScanning(true);
    setFailed(false);
    try {
      track("scan_started", { source: "onboarding" });
      const { data, error } = await supabase.functions.invoke("hibp-scan");
      if (error || !data?.scan_run_id) throw new Error(data?.error || error?.message || "The check could not be started.");
      setScanRunId(data.scan_run_id);
    } catch (e) {
      console.error("Breach check failed:", e);
      setScanning(false);
      setFailed(true);
    }
  };

  const skip = async () => {
    try {
      await markDone();
    } catch {
      toast({ title: "Couldn't save that", description: "You can still continue.", variant: "destructive" });
    }
    onComplete();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <img src="/logo.png" alt="BreachPay" width={121} height={40} className="h-10 w-auto" />
        </div>

        {result ? (
          <div className="glass-card-glow space-y-6 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
            </div>
            {result.breaches > 0 ? (
              <div>
                <h1 className="text-2xl font-bold">
                  {result.breaches} known breach{result.breaches === 1 ? "" : "es"} include your email
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {result.matches > 0
                    ? `${result.matches} listed settlement${result.matches === 1 ? "" : "s"} may be related. A match is a starting point, not a decision: the settlement administrator decides who is eligible.`
                    : "None of the settlements we list match those breaches right now. You can still browse everything that is open."}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold">No known breaches include your email</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  That's good news, though no database covers every breach. You can still browse the settlements that are open.
                </p>
              </div>
            )}
            <Button className="h-12 w-full rounded-xl text-base" onClick={onComplete}>
              Continue <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="glass-card space-y-6 p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Mail className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <h1 className="text-xl font-bold">Check your email for known breaches</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We'll look up <span className="font-medium text-foreground">{email}</span> in the Have I Been Pwned
                database of known breaches, then show any listed settlements that may be related.
              </p>
            </div>

            {failed && (
              <p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
                The check didn't finish. You can try again, or skip it and run it later from the Breach check page.
              </p>
            )}

            <div className="space-y-3">
              <Button className="h-12 w-full rounded-xl text-base" onClick={runCheck} disabled={scanning}>
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Checking…
                  </>
                ) : failed ? (
                  "Try again"
                ) : (
                  "Run the check"
                )}
              </Button>
              <Button variant="ghost" className="w-full rounded-xl" onClick={skip} disabled={scanning}>
                Skip for now
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Only this address is checked. The results are saved to your account so you can come back to them.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Signed in as {email}.{" "}
          <button type="button" onClick={() => signOut()} className="underline underline-offset-4 hover:text-foreground">
            Log out
          </button>
        </p>
      </div>
    </div>
  );
}
