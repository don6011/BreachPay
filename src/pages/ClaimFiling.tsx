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
  Bookmark, Eye, Send, Sparkles, ArrowRight, Loader2, ExternalLink, FileCheck,
} from "lucide-react";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { ClaimAccelerationCard } from "@/components/ClaimAccelerationCard";
import { IdentityProtectionUpsell } from "@/components/IdentityProtectionUpsell";

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
  const track = useTrackEvent();
  const settlementId = searchParams.get("settlement") || "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loadingSettlement, setLoadingSettlement] = useState(true);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);
  const [draftClaimId, setDraftClaimId] = useState<string | null>(null);
  const [eligibilityBlocked, setEligibilityBlocked] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const [generatingPacket, setGeneratingPacket] = useState(false);
  const [packetReady, setPacketReady] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);

  const [identity, setIdentity] = useState({ fullName: "", email: "", phone: "", address: "" });
  const [eligibility, setEligibility] = useState({
    breachImpact: false, financialLoss: false, monitoringPurchase: false,
    lossAmount: "", monitoringCost: "", description: "",
  });
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [consent, setConsent] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0].label);

  useEffect(() => {
    if (!settlementId || !user) { setLoadingSettlement(false); return; }
    const fetchSettlement = async () => {
      // Check for existing draft claim
      const { data: existingClaim } = await supabase
        .from("claims")
        .select("id")
        .eq("user_id", user.id)
        .eq("settlement_id", settlementId)
        .eq("status", "draft")
        .maybeSingle();

      if (existingClaim) {
        setDraftClaimId(existingClaim.id);
        // Load existing application data
        const { data: appData } = await supabase
          .from("claim_applications")
          .select("*")
          .eq("claim_id", existingClaim.id)
          .maybeSingle();
        if (appData) {
          setIdentity({
            fullName: appData.full_name || "",
            email: appData.email || "",
            phone: appData.phone || "",
            address: appData.address || "",
          });
          const answers = (appData.eligibility_answers as any) || {};
          setEligibility({
            breachImpact: answers.breachImpact || false,
            financialLoss: answers.financialLoss || false,
            monitoringPurchase: answers.monitoringPurchase || false,
            lossAmount: answers.lossAmount || "",
            monitoringCost: answers.monitoringCost || "",
            description: appData.breach_experience || "",
          });
        }
      }

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
  }, [settlementId, user]);

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

  // Create or get draft claim via guarded RPC
  const ensureDraftClaim = async (): Promise<string | null> => {
    if (draftClaimId) return draftClaimId;
    if (!user || !settlement) return null;

    // Find match_id if exists
    const { data: matchData } = await supabase
      .from("settlement_matches")
      .select("id")
      .eq("user_id", user.id)
      .eq("settlement_id", settlement.id)
      .order("confidence_score", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase.rpc("rpc_start_claim_guarded", {
      p_settlement_id: settlement.id,
      p_match_id: matchData?.id || null,
    });

    if (error) throw error;
    const result = data as any;

    if (!result.allowed) {
      setEligibilityBlocked(result.reason);
      throw new Error(result.reason);
    }

    setDraftClaimId(result.claim_id);
    if (!result.resumed) {
      track("claim_started", { claim_id: result.claim_id, settlement_id: settlement.id });
    }
    return result.claim_id;
  };

  // Hash a file for duplicate detection
  const hashFile = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  // Hash a string for fingerprinting
  const hashString = async (str: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  // Collect and store user fingerprint
  const collectFingerprint = async () => {
    if (!user) return;
    const emailHash = user.email ? await hashString(user.email) : null;
    const phoneHash = identity.phone ? await hashString(identity.phone) : null;
    // Simple device fingerprint from navigator properties
    const deviceStr = [navigator.userAgent, navigator.language, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join("|");
    const deviceHash = await hashString(deviceStr);

    await supabase.from("user_fingerprints").insert({
      user_id: user.id,
      email_hash: emailHash,
      phone_hash: phoneHash,
      device_hash: deviceHash,
      // IP hash handled server-side
    } as any);
  };

  const uploadDocuments = async (claimId: string) => {
    if (!user || documents.length === 0) return;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      setDocuments(prev => prev.map((d, idx) => idx === i ? { ...d, uploading: true } : d));

      const filePath = `${user.id}/${claimId}/${Date.now()}_${doc.file.name}`;
      const fileHash = await hashFile(doc.file);

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
        file_name: doc.name,
        file_size: doc.file.size,
        mime_type: doc.file.type,
        doc_type: doc.type,
        file_type: doc.type,
        note: doc.name,
        file_hash: fileHash,
      } as any);

      setDocuments(prev => prev.map((d, idx) => idx === i ? { ...d, uploading: false, uploaded: true, url: filePath } : d));
    }
  };

  // Save application data on step transitions
  const saveApplicationData = async (claimId: string) => {
    await supabase.from("claim_applications").update({
      full_name: identity.fullName || null,
      email: identity.email || null,
      phone: identity.phone || null,
      address: identity.address || null,
      breach_experience: eligibility.description || null,
      documentation_available: documents.length > 0,
      eligibility_answers: {
        breachImpact: eligibility.breachImpact,
        financialLoss: eligibility.financialLoss,
        monitoringPurchase: eligibility.monitoringPurchase,
        lossAmount: eligibility.lossAmount,
        monitoringCost: eligibility.monitoringCost,
      },
    }).eq("claim_id", claimId);
  };

  // Handle step navigation with auto-save
  const handleNextStep = async () => {
    if (step === 0) {
      // Create draft on "Start My Claim"
      try {
        const claimId = await ensureDraftClaim();
        if (!claimId) return;
      } catch (err) {
        toast({ title: "Error", description: "Failed to create draft claim.", variant: "destructive" });
        return;
      }
    }

    if (step >= 1 && draftClaimId) {
      await saveApplicationData(draftClaimId);
    }

    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!user || !settlement) return;
    setSubmitting(true);

    try {
      let claimId = draftClaimId;

      if (!claimId) {
        claimId = await ensureDraftClaim();
        if (!claimId) throw new Error("Failed to create claim");
      }

      // Collect fingerprint for fraud detection
      await collectFingerprint();

      // Save final application data
      await saveApplicationData(claimId);

      // Mark certifications signed + disclaimer accepted
      await supabase.from("claim_applications").update({
        certifications_signed: true,
        submitted_at: new Date().toISOString(),
        disclaimer_accepted_at: new Date().toISOString(),
      } as any).eq("claim_id", claimId);

      // Upload documents
      if (documents.length > 0) {
        await uploadDocuments(claimId);
      }

      // Use guarded submit RPC
      const { data: submitResult, error: submitError } = await supabase.rpc("rpc_submit_claim_guarded", {
        p_claim_id: claimId,
      });

      if (submitError) throw submitError;
      const result = submitResult as any;
      if (!result.allowed) {
        setEligibilityBlocked(result.reason);
        toast({ title: "Submission Blocked", description: result.reason, variant: "destructive" });
        return;
      }

      setCreatedClaimId(claimId);
      setSubmitted(true);
      track("claim_filed", { claim_id: claimId, settlement_id: settlement.id });
      if (documents.length > 0) track("doc_uploaded", { claim_id: claimId, doc_count: documents.length });
      toast({ title: "Claim Packet Preparing", description: `Your claim packet for ${settlement.name} is being generated.` });

      // Auto-generate claim packet
      setGeneratingPacket(true);
      try {
        const { data: packetData, error: packetErr } = await supabase.functions.invoke("generate-claim-packet", {
          body: { claim_id: claimId },
        });
        if (packetErr) throw packetErr;
        if (!packetData?.ok) throw new Error(packetData?.error || "Packet generation failed");
        setPacketReady(true);
        track("packet_generated", { claim_id: claimId });
      } catch (pe: any) {
        console.error("Packet generation error:", pe);
        setPacketError(pe.message || "Could not generate packet. You can try again from your claim tracker.");
      } finally {
        setGeneratingPacket(false);
      }
    } catch (error: any) {
      const msg = error?.message || "Failed to file claim. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
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

  if (deadlinePassed || eligibilityBlocked) {
    return (
      <div>
        <PageHeader title={deadlinePassed ? "Filing Closed" : "Not Eligible"} subtitle={deadlinePassed ? "The deadline for this settlement has passed" : "You cannot file this claim"} />
        <div className="mx-auto max-w-lg text-center space-y-4">
          <div className="rounded-2xl border bg-card p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">{deadlinePassed ? "Deadline Passed" : "Claim Blocked"}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {deadlinePassed
                ? <>The filing deadline for <span className="font-semibold text-foreground">{settlement.name}</span> was {effectiveDeadline}. Claims can no longer be submitted.</>
                : <>{eligibilityBlocked}</>
              }
            </p>
            <Button onClick={() => navigate("/settlements")}>View Other Settlements</Button>
          </div>
        </div>
      </div>
    );
  }

  const claimRefId = createdClaimId ? `BP-${createdClaimId.slice(0, 8).toUpperCase()}` : null;

  if (submitted) {
    return (
      <div>
        <PageHeader title="Claim Packet Ready" subtitle="Download and submit to the settlement administrator" />
        <div className="mx-auto max-w-lg text-center space-y-6">
          <div className="rounded-2xl border bg-card p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              {generatingPacket ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : packetReady ? (
                <FileText className="h-8 w-8 text-success" />
              ) : (
                <CheckCircle className="h-8 w-8 text-success" />
              )}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {generatingPacket ? "Generating Your Claim Packet…" : packetReady ? "Your Claim Packet is Ready" : "Claim Information Prepared"}
            </h2>
            <p className="text-muted-foreground text-sm mb-1">
              {generatingPacket
                ? "We're preparing your claim documents. This usually takes a few seconds."
                : packetReady
                ? "Download your claim packet below and submit it to the official settlement administrator."
                : "Your claim information has been saved. Download the packet to submit your claim."}
            </p>
            <p className="text-muted-foreground text-xs mb-4">
              BreachPay prepares your claim packet — you submit it to the settlement administrator. BreachPay does not file claims on your behalf.
            </p>

            {/* Settlement name with company */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground uppercase">
                {settlement.company?.slice(0, 2) || "??"}
              </div>
              <span className="font-semibold text-foreground">{settlement.name}</span>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Payout</span>
                <span className="font-semibold text-primary">{settlement.payout_min > 0 && settlement.payout_max > 0 && settlement.payout_min !== settlement.payout_max ? `$${settlement.payout_min.toLocaleString()} – $${settlement.payout_max.toLocaleString()}` : `Up to $${Math.max(settlement.payout_min, settlement.payout_max).toLocaleString()}`}</span>
              </div>
              {claimRefId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Claim ID</span>
                  <span className="font-mono text-xs font-semibold text-foreground">{claimRefId}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span className="text-muted-foreground">15% only if paid</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-warning">Packet ready — awaiting your submission</span>
              </div>
            </div>

            {/* Packet download / error */}
            {generatingPacket && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating packet…
              </div>
            )}
            {packetError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 mb-4">
                <p className="text-xs text-destructive">{packetError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={async () => {
                    if (!createdClaimId) return;
                    setGeneratingPacket(true);
                    setPacketError(null);
                    try {
                      const { data, error } = await supabase.functions.invoke("generate-claim-packet", {
                        body: { claim_id: createdClaimId },
                      });
                      if (error) throw error;
                      if (!data?.ok) throw new Error(data?.error || "Failed");
                      setPacketReady(true);
                      track("packet_generated", { claim_id: createdClaimId });
                    } catch (e: any) {
                      setPacketError(e.message);
                    } finally {
                      setGeneratingPacket(false);
                    }
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
            {packetReady && (
              <Button
                className="w-full mb-4 rounded-xl gap-2"
                onClick={async () => {
                  if (!createdClaimId) return;
                  // Fetch the packet URL from claim_packets
                  const { data: packet } = await supabase
                    .from("claim_packets")
                    .select("packet_url, pdf_storage_path")
                    .eq("claim_id", createdClaimId)
                    .order("generated_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (packet?.packet_url) {
                    window.open(packet.packet_url, "_blank");
                  } else if (packet?.pdf_storage_path) {
                    const { data: signedUrl } = await supabase.storage
                      .from("claim-packets")
                      .createSignedUrl(packet.pdf_storage_path, 300);
                    if (signedUrl?.signedUrl) window.open(signedUrl.signedUrl, "_blank");
                    else toast({ title: "Error", description: "Could not generate download link", variant: "destructive" });
                  } else {
                    toast({ title: "Packet not found", description: "Please try again or contact support.", variant: "destructive" });
                  }
                  track("packet_downloaded", { claim_id: createdClaimId });
                }}
              >
                <FileText className="h-4 w-4" /> Download Claim Packet
              </Button>
            )}

            {/* Next steps */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4 text-left space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-primary" /> Next Steps
              </h3>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download your claim packet above</li>
                <li>Visit the official settlement website to submit your claim</li>
                <li>Upload the packet or enter the information as required</li>
                <li>Return here to track your claim status</li>
              </ol>
              {settlement.claims_filing_url && (
                <a
                  href={settlement.claims_filing_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="h-3 w-3" /> Go to Official Claim Site
                </a>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Eligibility depends on settlement administrator review. BreachPay is not a law firm, does not file claims on your behalf, and does not guarantee payouts.
            </p>

            <div className="flex items-center gap-1 mb-6">
              {["Packet Ready", "You Submit", "Under Review", "Paid"].map((s, i) => (
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

          {/* Optional Claim Assistance - post submission upsell */}
          {createdClaimId && (
            <ClaimAccelerationCard
              claimId={createdClaimId}
              estPayout={settlement ? (settlement.payout_min + settlement.payout_max) / 2 : undefined}
            />
          )}

          {/* Identity Protection - post claim */}
          <IdentityProtectionUpsell placement="post_claim" compact />

          {/* Share / Invite section */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Know someone affected by this breach?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Invite them to check their eligibility with BreachPay.
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1 rounded-xl"
                onClick={() => {
                  const url = `${window.location.origin}/signup`;
                  if (navigator.share) {
                    navigator.share({ title: "Check if you're owed money from data breaches", text: "I found settlement opportunities with BreachPay. You might be eligible too.", url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(url);
                    toast({ title: "Link copied!" });
                  }
                }}
              >
                <Send className="h-4 w-4 mr-1" /> Invite Friends
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/signup`);
                  toast({ title: "Link copied to clipboard" });
                }}
              >
                <Bookmark className="h-4 w-4 mr-1" /> Copy Link
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

      {/* Step indicator */}
      <div className="mb-2 text-center">
        <span className="text-xs font-semibold text-primary">Step {step + 1} of {STEPS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          {STEPS.map((s, i) => (
            <span key={s} className={`flex items-center gap-1 ${i < step ? "text-success" : i === step ? "text-primary font-medium" : ""}`}>
              {i < step && <CheckCircle className="h-3 w-3" />}
              {s}
            </span>
          ))}
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      <div className="mx-auto max-w-2xl">

        {/* Claim preparation notice */}
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
          <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            BreachPay helps prepare and submit your claim information. Final approval and payouts are determined by the official settlement administrator.
          </p>
        </div>

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
              {/* Settlement branding */}
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground uppercase">
                  {settlement.company?.slice(0, 2) || "??"}
                </div>
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
                  <p className="text-[10px] text-muted-foreground mt-1">Actual payout amounts depend on settlement administrator review and total claims submitted.</p>
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
              <Button className="flex-1" onClick={handleNextStep}>
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

              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                <FileCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                Providing supporting documents may increase your claim approval chances.
              </p>

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
                  <p className="text-[10px] text-muted-foreground">Actual payout amounts depend on settlement administrator review and total claims submitted. 15% platform fee applies only if paid.</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</h4>
                  <p className="text-sm">{documents.length} document(s) attached</p>
                </div>
              </div>

              {/* Claim Assistance Disclaimer */}
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Claims Assistance Disclaimer</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      BreachPay assists in preparing and submitting claims but does not determine eligibility or payout amounts. Final decisions are made by settlement administrators. BreachPay is not a law firm and does not provide legal advice.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <div>
                  <Label htmlFor="consent" className="font-medium cursor-pointer">I confirm this information is accurate and accept the disclaimer above</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    I understand that eligibility depends on settlement administrator review, estimated payouts may vary, and I have read the <a href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>.
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
              <Button onClick={handleNextStep} disabled={!canProceed}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed || submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Preparing Packet...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-1" /> Prepare Claim Packet</>
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
