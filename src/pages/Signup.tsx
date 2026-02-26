import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: referralCode ? { referral_code: referralCode } : undefined,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      // If referral code provided, create referral record
      if (referralCode && signUpData.user) {
        // Find referrer by code
        const { data: referrer } = await supabase
          .from("user_profiles")
          .select("user_id")
          .eq("referral_code", referralCode)
          .maybeSingle();

        if (referrer) {
          await supabase.from("user_referrals").insert({
            referrer_user_id: referrer.user_id,
            referred_user_id: signUpData.user.id,
            referral_code: referralCode,
            status: "activated",
          });
        }
      }

      toast.success("Account created! Check your email to confirm, or log in now.");
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <img src={logo} alt="BreachPay" className="h-12 drop-shadow-[0_0_20px_hsl(164_100%_45%/0.2)]" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-8">
          <h2 className="mb-1 text-xl font-bold">Create Account</h2>
          <p className="mb-6 text-sm text-muted-foreground">Start protecting your identity today</p>
          {referralCode && (
            <div className="mb-4 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
              🎉 You were referred by a friend — you'll both benefit when you submit a claim!
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl" />
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2">
                <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(!!v)} />
                <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
                  I agree to the <span className="text-primary cursor-pointer">Terms of Service</span> and <span className="text-primary cursor-pointer">Privacy Policy</span>
                </label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight">
                  I authorize BreachPay to scan breach databases on my behalf
                </label>
              </div>
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={!terms || !consent || loading}>
              {loading ? "Creating…" : "Create Account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
