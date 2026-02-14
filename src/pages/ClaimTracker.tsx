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
  AlertTriangle, Shield, Loader2, X, ExternalLink, MessageSquare,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRef } from "react";

const PROGRESS_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
];

const DOC_TYPES = ["ID Verification", "Address Proof", "Breach Notice", "Expense Proof"];

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
          settlements(id, name, company, breach_year, deadline, payout_min, payout_max)
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
      const filePath = `${user.id}/${claimId}/${Date.now()}_${file.name}`;
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
        note: `Document uploaded: ${file.name} (${selectedDocType})`,
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Filing Date</p>
              <p className="text-sm font-semibold">{claim.filed_at ? new Date(claim.filed_at).toLocaleDateString() : "—"}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Estimated Payout</p>
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
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm">{doc.note || doc.file_path.split("/").pop()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleString()}</p>
                    </div>
                    {doc.file_type && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{doc.file_type}</span>
                    )}
                    {doc.verified && (
                      <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle className="h-2.5 w-2.5" /> Verified
                      </span>
                    )}
                  </div>
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
      </div>
    </div>
  );
};

export default ClaimTracker;
