import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { VerificationBadge } from "@/components/VerificationBadge";
import { DeadlineBadge, isDeadlinePassed } from "@/components/DeadlineBadge";
import { PayoutRange } from "@/components/PayoutRange";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Lock, ChevronRight, ChevronLeft, Upload, FileText,
  Clock, AlertTriangle, CheckCircle, DollarSign, Camera, X, XCircle,
  Bookmark, Eye, Send, Sparkles, ArrowRight, Loader2, ExternalLink,
} from "lucide-react";

const STEPS = ["Overview", "Identity", "Eligibility", "Documents", "Review"];

const DOC_TYPES = [
  { label: "ID Verification", accept: "image/*,.pdf" },
  { label: "Address Proof", accept: "image/*,.pdf" },
  { label: "Breach Notice", accept: "image/*,.pdf" },
  { label: "Expense Proof", accept: "image/*,.pdf" },
];

interface SettlementData {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  description: string | null;
  payout_min: number;
  payout_max: number;
  deadline: string;
  status: string;
  verified: boolean;
  verification_level: string;
  claim_deadline: string | null;
  official_source_url: string | null;
  claims_filing_url: string | null;
  administrator_name: string | null;
  source_url: string | null;
}

interface UploadedDoc {
  name: string;
  size: string;
  type: string;
  file: File;
  uploading?: boolean;
  uploaded?: boolean;
  url?: string;
}

const ClaimFiling = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settlementId = searchParams.get("settlement") || "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loadingSettlement, setLoadingSettlement] = useState(true);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);

  const [identity, setIdentity] = useState({ fullName: "", email: "", phone: "", address: "" });
  const [eligibility, setEligibility] = useState({
    breachImpact: false, financialLoss: false, monitoringPurchase: false,
    lossAmount: "", monitoringCost: "", description: "",
  });
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [consent, setConsent] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0].label);

  useEffect(() => {
    if (!settlementId) { setLoadingSettlement(false); return; }
    const fetchSettlement = async () => {
      const { data } = await supabase
        .from("settlements")
        .select("id, name, company, breach_year, description, payout_min, payout_max, deadline, status, verified, verification_level, claim_deadline, official_source_url, claims_filing_url, administrator_name, source_url")
        .eq("id", settlementId)
        .maybeSingle();
      if (data) {
        setSettlement({
          ...data,
          payout_min: Number(data.payout_min) || 0,
          payout_max: Number(data.payout_max) || 0,
          deadline: data.deadline || "",
          verified: data.verified || false,
          verification_level: data.verification_level || "unverified",
          claim_deadline: data.claim_deadline || null,
          official_source_url: data.official_source_url || null,
          claims_filing_url: data.claims_filing_url || null,
          administrator_name: data.administrator_name || null,
          source_url: data.source_url || null,
        });
      }
      setLoadingSettlement(false);
    };
    fetchSettlement();
  }, [settlementId]);

  useEffect(() => {
    if (user?.email && !identity.email) {
      setIdentity(prev => ({ ...prev, email: user.email! }));
    }
  }, [user]);

  const effectiveDeadline = settlement?.claim_deadline || settlement?.deadline || "";

  const deadlineDays = useMemo(() => {
    if (!effectiveDeadline) return 0;
    const diff = new Date(effectiveDeadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [effectiveDeadline]);

  const deadlineColor = deadlineDays <= 30 ? "text-destructive" : deadlineDays <= 60 ? "text-warning" : "text-success";

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: UploadedDoc[] = Array.from(files).map(file => ({
      name: file.name,
      size: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`,
      type: selectedDocType,
      file,
    }));
    setDocuments(prev => [...prev, ...newDocs]);
    e.target.value = "";
  }, [selectedDocType]);

  const removeFile = useCallback((index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
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

  const uploadDocuments = async (claimId: string) => {
    if (!user || documents.length === 0) return;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      setDocuments(prev => prev.map((d, idx) => idx === i ? { ...d, uploading: true } : d));

      const filePath = `${user.id}/${claimId}/${Date.now()}_${doc.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("claim-documents")
        .upload(filePath, doc.file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("claim_documents").insert({
        claim_id: claimId,
        user_id: user.id,
        file_path: filePath,
        file_type: doc.type,
        note: doc.name,
      });

      setDocuments(prev => prev.map((d, idx) => idx === i ? { ...d, uploading: false, uploaded: true, url: filePath } : d));
    }

    await supabase.from("claim_status_history").insert({
      claim_id: claimId,
      status: "submitted",
      note: `${documents.length} document(s) uploaded`,
      updated_by: "user",
    });
  };

  const handleSubmit = async () => {
    if (!user || !settlement) return;
    setSubmitting(true);

    try {
      const estPayout = (settlement.payout_min + settlement.payout_max) / 2;

      const { data: claimData, error } = await supabase.from("claims").insert({
        user_id: user.id,
        settlement_id: settlement.id,
        est_payout: estPayout,
        filed_at: new Date().toISOString().split("T")[0],
        status: "submitted",
      }).select("id").single();

      if (error) throw error;

      const claimId = claimData.id;
      setCreatedClaimId(claimId);

      await supabase.from("claim_status_history").insert({
        claim_id: claimId,
        status: "submitted",
        note: `Claim filed for ${settlement.name}`,
        updated_by: "user",
      });

      if (documents.length > 0) {
        await uploadDocuments(claimId);
      }

      setSubmitted(true);
      toast({ title: "Claim Filed!", description: `Your claim for ${settlement.name} has been submitted.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to file claim. Please try again.", variant: "destructive" });
      console.error("Claim filing error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSettlement) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div>
        <PageHeader title="Settlement Not Found" subtitle="The requested settlement could not be found" />
        <Button onClick={() => navigate("/settlements")}>Back to Settlements</Button>
      </div>
    );
  }
  const deadlinePassed = isDeadlinePassed(effectiveDeadline);

  if (deadlinePassed) {
    return (
      <div>
        <PageHeader title="Filing Closed" subtitle="The deadline for this settlement has passed" />
        <div className="mx-auto max-w-lg text-center space-y-4">
          <div className="rounded-2xl border bg-card p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">Deadline Passed</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The filing deadline for <span className="font-semibold text-foreground">{settlement.name}</span> was {effectiveDeadline}. Claims can no longer be submitted.
            </p>
            <Button onClick={() => navigate("/settlements")}>View Other Settlements</Button>
          </div>
        </div>
      </div>
    );
  }

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
                <span className="font-semibold text-primary">{settlement.payout_min > 0 && settlement.payout_max > 0 && settlement.payout_min !== settlement.payout_max ? `$${settlement.payout_min.toLocaleString()} – $${settlement.payout_max.toLocaleString()}` : `Up to $${Math.max(settlement.payout_min, settlement.payout_max).toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span className="text-muted-foreground">15% only if paid</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-warning">Submitted — pending review</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Eligibility depends on settlement administrator review. Filing deadline is enforced by the settlement administrator.
            </p>

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
              {createdClaimId && (
                <Button variant="outline" className="flex-1" onClick={() => navigate(`/claims/${createdClaimId}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Track Claim
                </Button>
              )}
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

        {/* Verified Settlement Callout */}
        {settlement.verified && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <VerificationBadge
              level={settlement.verification_level}
              verified={settlement.verified}
              sourceUrl={settlement.official_source_url || settlement.source_url}
            />
            {settlement.claims_filing_url && (
              <a href={settlement.claims_filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 ml-6.5">
                <ExternalLink className="h-3 w-3" /> Claims filing site
              </a>
            )}
          </div>
        )}

        {/* STEP 0 — Overview */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{settlement.name}</h2>
                  <p className="text-sm text-muted-foreground">{settlement.company} · {settlement.breach_year} Breach</p>
                </div>
              </div>
              {settlement.description && <p className="text-sm text-muted-foreground">{settlement.description}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Estimated Payout</p>
                  <PayoutRange min={settlement.payout_min} max={settlement.payout_max} size="md" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Subject to administrator review</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Subject to administrator review</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Filing Deadline</p>
                  </div>
                  <p className={`text-lg font-bold ${deadlineColor}`}>{deadlineDays} days</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Enforced by settlement administrator</p>
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
                    <Input id="address" placeholder="City, State" value={identity.address} onChange={(e) => setIdentity((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">Your data is encrypted and used solely for claim verification.</p>
            </div>
          </div>
        )}

        {/* STEP 2 — Eligibility */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Eligibility Questions</h2>
                <p className="text-sm text-muted-foreground">Confirm your eligibility for this settlement.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                  <Checkbox id="breachImpact" checked={eligibility.breachImpact} onCheckedChange={(v) => setEligibility((p) => ({ ...p, breachImpact: !!v }))} className="mt-0.5" />
                  <div>
                    <Label htmlFor="breachImpact" className="font-medium cursor-pointer">I was affected by this data breach</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">My personal data was exposed in the {settlement.company} breach ({settlement.breach_year}).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                  <Checkbox id="financialLoss" checked={eligibility.financialLoss} onCheckedChange={(v) => setEligibility((p) => ({ ...p, financialLoss: !!v }))} className="mt-0.5" />
                  <div>
                    <Label htmlFor="financialLoss" className="font-medium cursor-pointer">I experienced financial loss</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">I incurred out-of-pocket costs as a result of this breach.</p>
                    {eligibility.financialLoss && (
                      <Input placeholder="Amount ($)" type="number" className="mt-2 max-w-[200px]" value={eligibility.lossAmount} onChange={(e) => setEligibility((p) => ({ ...p, lossAmount: e.target.value }))} />
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                  <Checkbox id="monitoringPurchase" checked={eligibility.monitoringPurchase} onCheckedChange={(v) => setEligibility((p) => ({ ...p, monitoringPurchase: !!v }))} className="mt-0.5" />
                  <div>
                    <Label htmlFor="monitoringPurchase" className="font-medium cursor-pointer">I purchased credit monitoring</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">I signed up for credit monitoring due to this breach.</p>
                    {eligibility.monitoringPurchase && (
                      <Input placeholder="Cost ($)" type="number" className="mt-2 max-w-[200px]" value={eligibility.monitoringCost} onChange={(e) => setEligibility((p) => ({ ...p, monitoringCost: e.target.value }))} />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Additional Details (optional)</Label>
                  <Textarea id="description" placeholder="Describe your experience..." value={eligibility.description} onChange={(e) => setEligibility((p) => ({ ...p, description: e.target.value }))} rows={3} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Supporting Documents</h2>
                <p className="text-sm text-muted-foreground">Upload documents to strengthen your claim.</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {DOC_TYPES.map(dt => (
                  <button
                    key={dt.label}
                    onClick={() => setSelectedDocType(dt.label)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${selectedDocType === dt.label ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>

              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" multiple onChange={handleFileSelect} />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 p-6 text-center transition-colors group cursor-pointer"
              >
                <Upload className="mx-auto h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type: <span className="text-primary">{selectedDocType}</span> · PDF or image
                </p>
              </button>

              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} · {doc.size}</p>
                      </div>
                      {doc.uploading ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : doc.uploaded ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <button onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      )}
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
              <div>
                <h2 className="text-lg font-bold mb-1">Review & Submit</h2>
                <p className="text-sm text-muted-foreground">Review your claim details before submitting.</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settlement</h4>
                  <p className="text-sm font-semibold">{settlement.name}</p>
                  <p className="text-xs text-muted-foreground">{settlement.company} · {settlement.breach_year}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Information</h4>
                  <p className="text-sm">{identity.fullName}</p>
                  <p className="text-xs text-muted-foreground">{identity.email}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated Payout</h4>
                  <p className="text-sm font-bold text-primary">${settlement.payout_min} – ${settlement.payout_max}</p>
                  <p className="text-[10px] text-muted-foreground">Subject to administrator review. 15% platform fee applies only if paid.</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</h4>
                  <p className="text-sm">{documents.length} document(s) attached</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <div>
                  <Label htmlFor="consent" className="font-medium cursor-pointer">I confirm this information is accurate</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    I understand that eligibility depends on settlement administrator review and that estimated payouts may vary.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step > 0 && (
          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed || submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4 mr-1" /> Submit Claim</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimFiling;
