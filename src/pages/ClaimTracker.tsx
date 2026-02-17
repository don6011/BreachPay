import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, FileText, Upload, CheckCircle, Clock, DollarSign,
  AlertTriangle, Shield, Loader2, X, ExternalLink, MessageSquare, Info,
  ShieldCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useRef } from "react";

const PROGRESS_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
];

const DOC_TYPES = ["ID Verification", "Address Proof", "Breach Notice", "Expense Proof"];

const VERIFICATION_LABELS: Record<string, string> = {
  source_linked: "Source linked",
  court_verified: "Court verified",
  administrator_confirmed: "Administrator confirmed",
};

interface ClaimDetail {
  id: string;
  status: string;
  est_payout: number;
  filed_at: string | null;
  updated_at: string;
  fee_percent: number;
  final_payout: number | null;
  flag_reason: string | null;
  settlement: {
    id: string;
    name: string;
    company: string;
    breach_year: number | null;
    deadline: string | null;
    payout_min: number;
    payout_max: number;
    verified: boolean;
    verification_level: string;
    claim_deadline: string | null;
    official_source_url: string | null;
    claims_filing_url: string | null;
    administrator_name: string | null;
  } | null;
}

interface HistoryEntry {
  id: string;
  status: string;
  note: string | null;
  updated_by: string | null;
  created_at: string;
}

interface DocEntry {
  id: string;
  file_path: string;
  file_type: string | null;
  note: string | null;
  created_at: string;
  verified: boolean;
}

const ClaimTracker = () => {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0]);

  useEffect(() => {
    if (!user || !claimId) return;
    fetchAll();
  }, [user, claimId]);

  const fetchAll = async () => {
    if (!claimId) return;
    setLoading(true);

    const [claimRes, historyRes, docsRes] = await Promise.all([
      supabase
        .from("claims")
        .select(`
          id, status, est_payout, filed_at, updated_at, fee_percent, final_payout, flag_reason,
          settlements(id, name, company, breach_year, deadline, payout_min, payout_max, verified, verification_level, claim_deadline, official_source_url, claims_filing_url, administrator_name)
        `)
        .eq("id", claimId)
        .maybeSingle(),
      supabase
        .from("claim_status_history")
        .select("id, status, note, updated_by, created_at")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true }),
      supabase
        .from("claim_documents")
        .select("id, file_path, file_type, note, created_at, verified")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true }),
    ]);

    if (claimRes.data) {
      const c = claimRes.data as any;
      setClaim({
        ...c,
        est_payout: Number(c.est_payout) || 0,
        fee_percent: Number(c.fee_percent) || 15,
        final_payout: c.final_payout ? Number(c.final_payout) : null,
        settlement: c.settlements ? {
          ...c.settlements,
          payout_min: Number(c.settlements.payout_min) || 0,
          payout_max: Number(c.settlements.payout_max) || 0,
          verified: c.settlements.verified || false,
          verification_level: c.settlements.verification_level || "unverified",
          claim_deadline: c.settlements.claim_deadline || null,
          official_source_url: c.settlements.official_source_url || null,
          claims_filing_url: c.settlements.claims_filing_url || null,
          administrator_name: c.settlements.administrator_name || null,
        } : null,
      });
    }

    if (historyRes.data) setHistory(historyRes.data);
    if (docsRes.data) setDocuments(docsRes.data);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !claimId) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const docTypeSlug = selectedDocType.toLowerCase().replace(/\s+/g, "_");
      const filePath = `${user.id}/${claimId}/${docTypeSlug}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("claim-documents")
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      await supabase.from("claim_documents").insert({
        claim_id: claimId,
        user_id: user.id,
        file_path: filePath,
        file_type: selectedDocType,
        note: file.name,
      });

      await supabase.from("claim_status_history").insert({
        claim_id: claimId,
        status: claim?.status || "submitted",
        note: `Document uploaded: ${selectedDocType}`,
        updated_by: "user",
      });
    }

    e.target.value = "";
    setUploading(false);
    toast({ title: "Documents uploaded" });
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div>
        <PageHeader title="Claim Not Found" subtitle="This claim doesn't exist or you don't have access" />
        <Button onClick={() => navigate("/claims")}>Back to Claims</Button>
      </div>
    );
  }

  const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.key === claim.status);
  const isRejected = claim.status === "rejected";
  const isDocRequired = claim.status === "documentation_required";
  const progressPercent = isRejected ? 0 : ((Math.max(0, currentStepIndex) + 1) / PROGRESS_STEPS.length) * 100;
  const effectiveDeadline = claim.settlement?.claim_deadline || claim.settlement?.deadline;

  return (
    <div>
      <PageHeader
        title="Claim Tracker"
        subtitle={claim.settlement?.name || "Claim Details"}
      />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/claims")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Claims
        </Button>

        {/* Verified Settlement Callout */}
        {claim.settlement?.verified && (
          <div className="rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/10 p-3 flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Verified settlement</p>
              <p className="text-xs text-green-700/80 dark:text-green-400/70">
                {VERIFICATION_LABELS[claim.settlement.verification_level] || "Verified"}
                {claim.settlement.administrator_name && ` by ${claim.settlement.administrator_name}`}.
                Eligibility depends on settlement administrator review.
              </p>
              <div className="flex gap-2 mt-1">
                {claim.settlement.official_source_url && (
                  <a href={claim.settlement.official_source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                    <ExternalLink className="h-2.5 w-2.5" /> Official source
                  </a>
                )}
                {claim.settlement.claims_filing_url && (
                  <a href={claim.settlement.claims_filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                    <ExternalLink className="h-2.5 w-2.5" /> Claims filing site
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status & Settlement Card */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">{claim.settlement?.name}</h2>
              <p className="text-sm text-muted-foreground">
                {claim.settlement?.company} · {claim.settlement?.breach_year} Breach
              </p>
            </div>
            <StatusPill variant={claim.status as any} />
          </div>

          {/* Deadline Countdown */}
          {effectiveDeadline && (() => {
            const daysLeft = Math.max(0, Math.ceil((new Date(effectiveDeadline).getTime() - Date.now()) / 86400000));
            const isUrgent = daysLeft <= 30;
            return (
              <div className={`flex items-center gap-2 rounded-xl p-3 ${isUrgent ? "bg-destructive/10 border border-destructive/20" : "bg-muted/50"}`}>
                {isUrgent ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${isUrgent ? "text-destructive" : ""}`}>
                    {daysLeft} days until filing deadline
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Filing deadline: {new Date(effectiveDeadline).toLocaleDateString()} · Enforced by settlement administrator
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Filing Date</p>
              <p className="text-sm font-semibold">{claim.filed_at ? new Date(claim.filed_at).toLocaleDateString() : "—"}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-muted-foreground">Estimated Payout</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] bg-card border text-sm">
                      Estimates are based on settlement terms. Final amounts depend on administrator review and may vary.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm font-semibold text-primary">${claim.est_payout.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Platform Fee</p>
              <p className="text-sm font-semibold">{claim.fee_percent}%</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Net Payout</p>
              <p className="text-sm font-semibold text-success">
                {claim.final_payout
                  ? `$${claim.final_payout.toLocaleString()}`
                  : `~$${Math.round(claim.est_payout * (1 - claim.fee_percent / 100)).toLocaleString()}`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-4">Claim Progress</h3>
          {isRejected ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="font-semibold text-destructive">Claim Rejected</p>
              </div>
              {claim.flag_reason && (
                <p className="text-sm text-muted-foreground">{claim.flag_reason}</p>
              )}
              <Button variant="outline" size="sm" className="rounded-xl mt-2">
                <MessageSquare className="h-4 w-4 mr-1" /> Contact Support
              </Button>
            </div>
          ) : isDocRequired ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-warning/10 border border-warning/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-warning" />
                  <p className="font-semibold text-warning">Documentation Required</p>
                </div>
                <p className="text-sm text-muted-foreground">Please upload the requested documents below to continue processing.</p>
              </div>
              <Progress value={50} className="h-2" />
              <div className="flex items-center gap-1">
                {PROGRESS_STEPS.map((s, i) => (
                  <div key={s.key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`h-3 w-3 rounded-full ${i <= 0 ? "bg-primary" : "bg-muted"}`} />
                      <span className={`mt-1 text-[10px] ${i <= 0 ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                    </div>
                    {i < PROGRESS_STEPS.length - 1 && <div className="h-0.5 flex-1 bg-muted" />}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center gap-1">
                {PROGRESS_STEPS.map((s, i) => {
                  const isComplete = i <= currentStepIndex;
                  const isCurrent = i === currentStepIndex;
                  return (
                    <div key={s.key} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center flex-1">
                        <div className={`h-3 w-3 rounded-full ${isComplete ? "bg-primary" : "bg-muted"} ${isCurrent ? "ring-2 ring-primary/30" : ""}`} />
                        <span className={`mt-1 text-[10px] ${isComplete ? "text-primary font-medium" : "text-muted-foreground"}`}>{s.label}</span>
                      </div>
                      {i < PROGRESS_STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 ${i < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Document Upload */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Documents</h3>
            <span className="text-xs text-muted-foreground">{documents.length} uploaded</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {DOC_TYPES.map(dt => (
              <button
                key={dt}
                onClick={() => setSelectedDocType(dt)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedDocType === dt
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {dt}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileUpload}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 p-6 text-center transition-colors group cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="mx-auto h-6 w-6 text-primary animate-spin mb-1" />
            ) : (
              <Upload className="mx-auto h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
            )}
            <p className="text-sm font-medium">{uploading ? "Uploading..." : "Upload documents"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Type: <span className="text-primary">{selectedDocType}</span>
            </p>
          </button>

          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${doc.verified ? "bg-success/10 border border-success/20" : "bg-muted/50"}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{doc.note || doc.file_path.split("/").pop()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleString()}</p>
                    </div>
                    {doc.file_type && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">{doc.file_type}</span>
                    )}
                    {doc.verified && (
                      <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                        <CheckCircle className="h-2.5 w-2.5" /> Verified
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 shrink-0 ml-2"
                    onClick={async () => {
                      const { data } = await supabase.storage
                        .from("claim-documents")
                        .createSignedUrl(doc.file_path, 600);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      else toast({ title: "Failed to generate download link", variant: "destructive" });
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Download</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Activity Timeline</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-0">
              {history.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full mt-1 ${
                      i === history.length - 1 ? "bg-primary ring-2 ring-primary/30" : "bg-muted"
                    }`} />
                    {i < history.length - 1 && <div className="w-0.5 flex-1 bg-border my-1" />}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{entry.note || `Status: ${entry.status}`}</p>
                      <StatusPill variant={entry.status as any} className="text-[9px] px-1.5 py-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(entry.created_at).toLocaleString()}
                      {entry.updated_by && ` · by ${entry.updated_by}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legal Disclaimer */}
        <p className="text-xs text-muted-foreground text-center pt-2 pb-4">
          BreachPay is not a law firm and does not provide legal advice. Estimated payouts are pending review and subject to settlement terms. Service fee of 15% applies only upon successful payout. Filing deadline is enforced by the settlement administrator.
        </p>
      </div>
    </div>
  );
};

export default ClaimTracker;
