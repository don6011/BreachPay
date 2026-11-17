import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email address"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); } else { setResetSent(true); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <Link to="/" aria-label="BreachPay home"><img src="/logo.png" alt="BreachPay" width={145} height={48} className="h-12 w-auto" /></Link>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8">
          {forgotMode ? (
            resetSent ? (
              <>
                <h2 className="mb-1 text-xl font-bold">Check Your Email</h2>
                <p className="mb-4 text-sm text-muted-foreground">We sent a password reset link to <strong>{email}</strong>.</p>
                <Button variant="ghost" className="w-full rounded-xl" onClick={() => { setForgotMode(false); setResetSent(false); }}>
                  Back to Log In
                </Button>
              </>
            ) : (
              <>
                <h2 className="mb-1 text-xl font-bold">Reset Password</h2>
                <p className="mb-6 text-sm text-muted-foreground">Enter your email to receive a reset link</p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Email</label>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full rounded-xl">
                    {loading ? "Sending…" : "Send Reset Link"}
                  </Button>
                </form>
                <button onClick={() => setForgotMode(false)} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to Log In
                </button>
              </>
            )
          ) : (
            <>
              <h2 className="mb-1 text-xl font-bold">Welcome Back</h2>
              <p className="mb-6 text-sm text-muted-foreground">Log in to your BreachPay account</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email</label>
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium">Password</label>
                    <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-primary hover:underline">Forgot password?</button>
                  </div>
                  <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl" />
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-xl">
                  {loading ? "Logging in…" : "Log In"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don't have an account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
