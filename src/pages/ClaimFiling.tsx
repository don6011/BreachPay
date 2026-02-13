import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { mockSettlements } from "@/data/mockData";
import {
  Shield, Lock, ChevronRight, ChevronLeft, Upload, FileText,
  Clock, AlertTriangle, CheckCircle, DollarSign, Camera, X,
  Bookmark, Eye, Send, Sparkles, ArrowRight
} from "lucide-react";

const STEPS = ["Overview", "Identity", "Eligibility", "Documents", "Review"];

const difficultyMap: Record<string, { label: string; color: string }> = {
  s1: { label: "Moderate", color: "text-warning" },
  s2: { label: "Easy", color: "text-success" },
  s3: { label: "Advanced", color: "text-destructive" },
  s4: { label: "Easy", color: "text-success" },
  s5: { label: "Easy", color: "text-success" },
};

const ClaimFiling = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const settlementId = searchParams.get("settlement") || "s1";
  const settlement = mockSettlements.find((s) => s.id === settlementId) || mockSettlements[0];
  const difficulty = difficultyMap[settlement.id] || { label: "Moderate", color: "text-warning" };

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [identity, setIdentity] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [eligibility, setEligibility] = useState({
    breachImpact: false,
    financialLoss: false,
    monitoringPurchase: false,
    lossAmount: "",
    monitoringCost: "",
    description: "",
  });
  const [documents, setDocuments] = useState<{ name: string; size: string }[]>([]);
  const [consent, setConsent] = useState(false);

  const deadlineDays = useMemo(() => {
    const diff = new Date(settlement.deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [settlement.deadline]);

  const deadlineColor = deadlineDays <= 30 ? "text-destructive" : deadlineDays <= 60 ? "text-warning" : "text-success";

  const handleFileAdd = useCallback(() => {
    const mockFiles = [
      { name: "bank_statement_2024.pdf", size: "2.4 MB" },
      { name: "fraud_report.pdf", size: "1.1 MB" },
      { name: "receipt_monitoring.jpg", size: "845 KB" },
    ];
    const next = mockFiles[documents.length % mockFiles.length];
    setDocuments((prev) => [...prev, next]);
  }, [documents.length]);

  const removeFile = useCallback((index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const progressPercent = submitted ? 100 : ((step + 1) / STEPS.length) * 100;

  const canProceed = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return identity.fullName.trim() && identity.email.trim();
    if (step === 2) return eligibility.breachImpact;
    if (step === 3) return true;
    if (step === 4) return consent;
    return true;
  }, [step, identity, eligibility, consent]);

  if (submitted) {
    return (
      <div>
        <PageHeader title="Claim Filed Successfully" subtitle="Your claim has been submitted for review" />
        <div className="mx-auto max-w-lg text-center space-y-6">
          <div className="rounded-2xl border bg-card p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold mb-2">Claim Submitted!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Your claim for <span className="text-foreground font-semibold">{settlement.name}</span> has been successfully filed.
            </p>
            <div className="rounded-xl bg-muted/50 p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Payout</span>
                <span className="font-semibold text-primary">${settlement.payout_min} – ${settlement.payout_max}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span className="text-muted-foreground">15% only if paid</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-warning">Submitted</span>
              </div>
            </div>

            {/* Mini status tracker */}
            <div className="flex items-center gap-1 mb-6">
              {["Submitted", "Under Review", "Approved", "Paid"].map((s, i) => (
                <div key={s} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`h-3 w-3 rounded-full ${i === 0 ? "bg-primary ring-2 ring-primary/30" : "bg-muted"}`} />
                    <span className={`mt-1 text-[10px] ${i === 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
                  </div>
                  {i < 3 && <div className="h-0.5 flex-1 bg-muted" />}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/claims")}>
                <Eye className="h-4 w-4 mr-1" /> View Claims
              </Button>
              <Button className="flex-1" onClick={() => navigate("/settlements")}>
                <ArrowRight className="h-4 w-4 mr-1" /> More Settlements
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="File Your Claim" subtitle={settlement.name} />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? "text-primary font-medium" : ""}>{s}</span>
          ))}
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      <div className="mx-auto max-w-2xl">
        {/* STEP 0 — Overview */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{settlement.name}</h2>
                  <p className="text-sm text-muted-foreground">{settlement.company} · {settlement.breach_year} Breach</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-muted ${difficulty.color}`}>
                  {difficulty.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{settlement.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Estimated Payout</p>
                  <p className="text-lg font-bold text-primary drop-shadow-[0_0_8px_hsl(172_89%_52%/0.4)]">
                    ${settlement.payout_min} – ${settlement.payout_max}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Deadline</p>
                  </div>
                  <p className={`text-lg font-bold ${deadlineColor}`}>{deadlineDays} days</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/settlements")}>
                <Bookmark className="h-4 w-4 mr-1" /> Save & Finish Later
              </Button>
              <Button className="flex-1" onClick={() => setStep(1)}>
                Start My Claim <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1 — Identity */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Identity Verification</h2>
                <p className="text-sm text-muted-foreground">Provide your details to verify eligibility.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Legal Name</Label>
                  <Input id="fullName" placeholder="John Doe" value={identity.fullName} onChange={(e) => setIdentity((p) => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={identity.email} onChange={(e) => setIdentity((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="(555) 123-4567" value={identity.phone} onChange={(e) => setIdentity((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" placeholder="123 Main St, City, ST" value={identity.address} onChange={(e) => setIdentity((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground pt-2 border-t border-border">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-primary" /> Encrypted submission</span>
                <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-primary" /> Bank-level security</span>
                <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-primary" /> Data never sold</span>
              </div>

              {/* Optional ID upload */}
              <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center">
                <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Optional: Upload government ID for faster verification</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Eligibility */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Eligibility Questions</h2>
                <p className="text-sm text-muted-foreground">Answer a few questions to confirm your eligibility.</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={eligibility.breachImpact} onCheckedChange={(v) => setEligibility((p) => ({ ...p, breachImpact: !!v }))} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Were you affected by this data breach?</p>
                    <p className="text-xs text-muted-foreground">Your data was found in our scan results for this breach.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={eligibility.financialLoss} onCheckedChange={(v) => setEligibility((p) => ({ ...p, financialLoss: !!v }))} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Did you experience financial loss?</p>
                    <p className="text-xs text-muted-foreground">Unauthorized charges, identity theft costs, etc.</p>
                  </div>
                </label>

                {eligibility.financialLoss && (
                  <div className="ml-8 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="lossAmount">Estimated Loss Amount</Label>
                    <Input id="lossAmount" placeholder="$0.00" value={eligibility.lossAmount} onChange={(e) => setEligibility((p) => ({ ...p, lossAmount: e.target.value }))} />
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={eligibility.monitoringPurchase} onCheckedChange={(v) => setEligibility((p) => ({ ...p, monitoringPurchase: !!v }))} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Did you purchase credit monitoring?</p>
                    <p className="text-xs text-muted-foreground">As a result of this breach.</p>
                  </div>
                </label>

                {eligibility.monitoringPurchase && (
                  <div className="ml-8 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="monitoringCost">Monitoring Cost</Label>
                    <Input id="monitoringCost" placeholder="$0.00" value={eligibility.monitoringCost} onChange={(e) => setEligibility((p) => ({ ...p, monitoringCost: e.target.value }))} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="desc">Additional Details (optional)</Label>
                  <Textarea id="desc" placeholder="Describe any additional impact..." value={eligibility.description} onChange={(e) => setEligibility((p) => ({ ...p, description: e.target.value }))} rows={3} />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Responses auto-saved as you type.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3 — Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Supporting Documents</h2>
                <p className="text-sm text-muted-foreground">Upload any evidence to strengthen your claim (optional).</p>
              </div>

              {/* Drop zone */}
              <button
                onClick={handleFileAdd}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 p-8 text-center transition-colors group cursor-pointer"
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                <p className="text-sm font-medium">Drag & drop files or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Bank statements, fraud reports, receipts, screenshots</p>
                <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> PDF, JPG, PNG</span>
                  <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> Camera capture</span>
                </div>
              </button>

              {/* Uploaded files */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{documents.length} file(s) uploaded</p>
                  {documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm">{doc.name}</span>
                        <span className="text-xs text-muted-foreground">{doc.size}</span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <h2 className="text-lg font-bold">Review & Submit</h2>

              {/* Claim summary */}
              <div className="space-y-3">
                <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Settlement</p>
                  <p className="font-semibold">{settlement.name}</p>
                  <p className="text-sm text-muted-foreground">{settlement.company} · {settlement.breach_year}</p>
                  <p className="text-primary font-bold drop-shadow-[0_0_8px_hsl(172_89%_52%/0.4)]">
                    ${settlement.payout_min} – ${settlement.payout_max}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Information</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {identity.fullName || "—"}</div>
                    <div><span className="text-muted-foreground">Email:</span> {identity.email || "—"}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {identity.phone || "—"}</div>
                    <div><span className="text-muted-foreground">Address:</span> {identity.address || "—"}</div>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Eligibility</p>
                  <div className="space-y-1 text-sm">
                    <p>Breach Impact: {eligibility.breachImpact ? "✓ Confirmed" : "—"}</p>
                    <p>Financial Loss: {eligibility.financialLoss ? `✓ ${eligibility.lossAmount || "Yes"}` : "No"}</p>
                    <p>Monitoring: {eligibility.monitoringPurchase ? `✓ ${eligibility.monitoringCost || "Yes"}` : "No"}</p>
                  </div>
                </div>

                {documents.length > 0 && (
                  <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documents ({documents.length})</p>
                    {documents.map((d, i) => (
                      <p key={i} className="text-sm flex items-center gap-2"><FileText className="h-3 w-3 text-primary" /> {d.name}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Fee disclosure */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Service Fee: 15% only if payout issued</p>
                  <p className="text-xs text-muted-foreground">You pay nothing upfront. BreachPay only earns when you do.</p>
                </div>
              </div>

              {/* Consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <p className="text-sm">I authorize BreachPay to file this claim on my behalf and agree to the <span className="text-primary underline cursor-pointer">terms of service</span>.</p>
              </label>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step > 0 && (
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed} className="flex-1">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setSubmitted(true)} disabled={!canProceed} className="flex-1 shadow-[0_0_20px_hsl(172_89%_52%/0.3)]">
                <Send className="h-4 w-4 mr-1" /> Submit Claim
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimFiling;
