import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockBreaches } from "@/data/mockData";
import { Search, Shield, AlertTriangle, Loader2 } from "lucide-react";

type ScanState = "idle" | "scanning" | "results";

const Scan = () => {
  const [state, setState] = useState<ScanState>("idle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (state === "scanning") {
      const timer = setTimeout(() => setState("results"), 3500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    setState("scanning");
  };

  const reset = () => { setState("idle"); setEmail(""); setPhone(""); };

  return (
    <div>
      <PageHeader title="Breach Scan" subtitle="Scan breach databases for your exposed data" />

      {state === "idle" && (
        <div className="mx-auto max-w-lg">
          <div className="rounded-lg border bg-card p-8">
            <div className="mb-6 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="mb-1 text-center text-lg font-bold">Secure Identity Scan</h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">We'll check your information against 12,000+ breach databases</p>
            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email Address</label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Phone Number <span className="text-muted-foreground">(optional)</span></label>
                <Input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" size="lg">
                <Search className="mr-2 h-4 w-4" /> Start Secure Scan
              </Button>
            </form>
          </div>
        </div>
      )}

      {state === "scanning" && (
        <div className="mx-auto max-w-lg text-center py-20">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">Scanning Databases...</h2>
          <p className="text-sm text-muted-foreground">Checking 12,847 breach databases for your identity</p>
          <div className="mt-6 mx-auto max-w-xs rounded-full bg-secondary h-2 overflow-hidden">
            <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: "70%" }} />
          </div>
        </div>
      )}

      {state === "results" && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-critical/10">
                <AlertTriangle className="h-5 w-5 text-critical" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{mockBreaches.length} Breaches Found</h2>
                <p className="text-sm text-muted-foreground">Risk Score: 82/100 (Severe)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-warning/15 px-2 py-1 text-xs font-medium text-warning">Demo Mode</span>
              <Button variant="outline" onClick={reset}>Run Another Scan</Button>
            </div>
          </div>

          <div className="space-y-3">
            {mockBreaches.map((breach) => (
              <div key={breach.id} className="rounded-lg border bg-card p-5 transition-all hover:border-primary/20">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{breach.company}</h3>
                    <p className="text-xs text-muted-foreground">Breach Year: {breach.breach_year} · {breach.records_affected.toLocaleString()} records</p>
                  </div>
                  <StatusPill variant={breach.severity} />
                </div>
                <p className="text-sm text-muted-foreground mb-3">{breach.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {breach.exposed_data.map((d) => (
                    <span key={d} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground text-center">
        BreachPay is not a law firm and does not provide legal advice. Data may be sourced from third-party providers and may be incomplete.
      </p>
    </div>
  );
};

export default Scan;
