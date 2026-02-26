import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { VerificationBadge } from "@/components/VerificationBadge";
import { EvidenceVault, type DocRow } from "@/components/EvidenceVault";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, FileText, Clock, DollarSign,
  AlertTriangle, Shield, Loader2, ExternalLink, MessageSquare, Info, Download, FilePlus, Upload, Link2, Copy, Check,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const PROGRESS_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
];

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
    source_url: string | null;
  } | null;
}

interface HistoryEntry {
  id: string;
  status: string;
  note: string | null;
  updated_by: string | null;
  created_at: string;
}

interface DocRequest {
  id: string;
  request_type: string;
  message: string | null;
  status: string;
  created_at: string;
  fulfilled_at: string | null;
}

interface PartnerNote {
  id: string;
  note: string;
  created_at: string;
}

const ClaimTracker = () => {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [docRequests, setDocRequests] = useState<DocRequest[]>([]);
  const [partnerNotes, setPartnerNotes] = useState<PartnerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPacket, setGeneratingPacket] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareScope, setShareScope] = useState<string>("packet");
  const [copied, setCopied] = useState(false);

  const handleGeneratePacket = async () => {
    if (!claimId) return;
    setGeneratingPacket(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-claim-packet", {
        body: { claim_id: claimId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Claim Packet Generated",
        description: `Packet "${data.packet_file}" saved with ${data.document_count} evidence file(s) indexed.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate packet", variant: "destructive" });
    } finally {
      setGeneratingPacket(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!claimId) return;
    setCreatingShare(true);
    try {
      const { data, error } = await supabase.functions.invoke("share-claim-packet", {
        body: { claim_id: claimId, scope: shareScope, hours: 168 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "zmjikithlaxeldvsmklz";
      const url = `https://${projectId}.supabase.co/functions/v1/share-claim-packet?token=${data.token}`;
      setShareUrl(url);
      toast({
        title: "Share Link Created",
        description: `Expires ${format(new Date(data.expires_at), "MMM d, yyyy")}. Scope: ${data.scope === "packet_and_evidence" ? "Packet + Evidence" : "Packet only"}.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create share link", variant: "destructive" });
    } finally {
      setCreatingShare(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  useEffect(() => {
    if (!user || !claimId) return;
    fetchAll();
  }, [user, claimId]);

  const fetchAll = async () => {
    if (!claimId) return;
    setLoading(true);

    const [claimRes, historyRes, docsRes, docReqRes, notesRes] = await Promise.all([
      supabase
        .from("claims")
        .select(`
          id, status, est_payout, filed_at, updated_at, fee_percent, final_payout, flag_reason,
          settlements(id, name, company, breach_year, deadline, payout_min, payout_max, verified, verification_level, claim_deadline, official_source_url, claims_filing_url, administrator_name, source_url)
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
        .select("id, claim_id, file_path, file_name, file_size, mime_type, doc_type, status, user_notes, admin_notes, created_at, verified")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true }),
      supabase
        .from("claim_doc_requests")
        .select("id, request_type, message, status, created_at, fulfilled_at")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false }),
      supabase
        .from("claim_partner_notes")
        .select("id, note, created_at")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false }),
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
          source_url: c.settlements.source_url || null,
        } : null,
      });
    }

    if (historyRes.data) setHistory(historyRes.data);
    if (docsRes.data) setDocuments(docsRes.data);
    setDocRequests((docReqRes.data as DocRequest[]) || []);
    setPartnerNotes((notesRes.data as PartnerNote[]) || []);
    setLoading(false);
  };

  const handleFulfillRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("claim_doc_requests")
        .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      toast({ title: "Request marked as fulfilled" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
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
  const openDocRequests = docRequests.filter(dr => dr.status === "open");

  return (
    <div>
      <PageHeader title="Claim Tracker" subtitle={claim.settlement?.name || "Claim Details"} />

      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/claims")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Claims
        </Button>

        {claim.status !== "draft" && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Claim Packet & Sharing
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleGeneratePacket} disabled={generatingPacket}>
                {generatingPacket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Generate Packet
              </Button>
              <div className="flex items-center gap-2">
                <Select value={shareScope} onValueChange={setShareScope}>
                  <SelectTrigger className="h-8 w-[180px] text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="packet">Packet only</SelectItem>
                    <SelectItem value="packet_and_evidence">Packet + Evidence</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleCreateShareLink} disabled={creatingShare}>
                  {creatingShare ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Create Share Link
                </Button>
              </div>
            </div>

            {shareUrl && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-primary">Share Link (expires in 7 days)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate">{shareUrl}</code>
                  <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleCopyShare}>
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Anyone with this link can view the claim packet{shareScope === "packet_and_evidence" ? " and download evidence documents" : ""}. Only the token hash is stored — no raw tokens in DB.
                </p>
              </div>
            )}
          </div>
        )}

        {claim.status === "draft" && claim.settlement && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-warning">Draft — Not yet submitted</p>
              <p className="text-xs text-muted-foreground">Complete the wizard to file this claim.</p>
            </div>
            <Button size="sm" className="rounded-xl" onClick={() => navigate(`/claims/file?settlement=${claim.settlement!.id}`)}>
              Continue Filing <ArrowLeft className="ml-1 h-3 w-3 rotate-180" />
            </Button>
          </div>
        )}

        {claim.settlement?.verified && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <VerificationBadge
              level={claim.settlement.verification_level}
              verified={claim.settlement.verified}
              sourceUrl={claim.settlement.official_source_url || claim.settlement.source_url}
            />
            {claim.settlement.claims_filing_url && (
              <a href={claim.settlement.claims_filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 ml-6.5">
                <ExternalLink className="h-3 w-3" /> Claims filing site
              </a>
            )}
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

          {effectiveDeadline && (() => {
            const daysLeft = Math.max(0, Math.ceil((new Date(effectiveDeadline).getTime() - Date.now()) / 86400000));
            const isUrgent = daysLeft <= 30;
            return (
              <div className={`flex items-center gap-2 rounded-xl p-3 ${isUrgent ? "bg-destructive/10 border border-destructive/20" : "bg-muted/50"}`}>
                {isUrgent ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${isUrgent ? "text-destructive" : ""}`}>{daysLeft} days until filing deadline</p>
                  <p className="text-xs text-muted-foreground">Filing deadline: {new Date(effectiveDeadline).toLocaleDateString()}</p>
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
                <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-[240px] bg-card border text-sm">Estimates are based on settlement terms.</TooltipContent>
                </Tooltip></TooltipProvider>
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
                {claim.final_payout ? `$${claim.final_payout.toLocaleString()}` : `~$${Math.round(claim.est_payout * (1 - claim.fee_percent / 100)).toLocaleString()}`}
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
              {claim.flag_reason && <p className="text-sm text-muted-foreground">{claim.flag_reason}</p>}
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
                      {i < PROGRESS_STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < currentStepIndex ? "bg-primary" : "bg-muted"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Partner Document Requests */}
        {openDocRequests.length > 0 && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FilePlus className="h-4 w-4 text-warning" /> Requests from Partner ({openDocRequests.length})
            </h3>
            <div className="space-y-3">
              {openDocRequests.map((dr) => (
                <div key={dr.id} className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{dr.request_type.replace(/_/g, " ")}</p>
                    {dr.message && <p className="text-xs text-muted-foreground mt-0.5">{dr.message}</p>}
                    <span className="text-[10px] text-muted-foreground">{format(new Date(dr.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={() => handleFulfillRequest(dr.id)}>
                    <Upload className="h-3 w-3 mr-1" /> Mark Fulfilled
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partner Notes (user-visible only) */}
        {partnerNotes.length > 0 && (
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Notes from Partner
            </h3>
            <div className="space-y-2">
              {partnerNotes.map((n) => (
                <div key={n.id} className="rounded-lg border p-3 text-sm">
                  <p>{n.note}</p>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, h:mm a")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Vault */}
        {claimId && (
          <EvidenceVault
            claimId={claimId}
            documents={documents as any}
            onRefresh={fetchAll}
            claimStatus={claim.status}
          />
        )}

        {/* Status History */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Activity Timeline</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, i) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${i === history.length - 1 ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/30"}`} />
                    {i < history.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <StatusPill variant={entry.status as any} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {entry.note && <p className="text-sm text-muted-foreground mt-1">{entry.note}</p>}
                    {entry.updated_by && <p className="text-[10px] text-muted-foreground mt-0.5">By: {entry.updated_by}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Eligibility depends on settlement administrator review. Estimated payouts are subject to settlement terms.
        </p>
      </div>
    </div>
  );
};

export default ClaimTracker;
