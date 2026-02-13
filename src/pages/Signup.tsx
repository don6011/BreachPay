import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import logo from "@/assets/logo.png";

const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <img src={logo} alt="BreachPay" className="h-12" />
        </div>
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="mb-1 text-xl font-bold">Create Account</h2>
          <p className="mb-6 text-sm text-muted-foreground">Start protecting your identity today</p>
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
            <Button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300" disabled={!terms || !consent}>Create Account</Button>
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
