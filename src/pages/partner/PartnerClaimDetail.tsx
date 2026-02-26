import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, FileText, Send, CheckCircle, ExternalLink, ThumbsUp, Play, SquareCheck, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClaimDetail {
  id: string;
  status: string;
  est_payout: number | null;
  filed_at: string | null;
  updated_at: string;
  user_id: string;
  settlement: { name: string; company: string; deadline: string | null; description: string | null; url: string | null };
}

interface HistoryEntry { id: string; status: string; old_status: string | null; note: string | null; created_at: string; updated_by: string | null; }
interface DocEntry { id: string; file_path: string; file_name: string; file_type: string | null; doc_type: string; note: string | null; created_at: string; verified: boolean; }
interface NoteEntry { id: string; note: string; created_at: string; }
interface BreachEvidence {
  source: string;
  breach_year: number | null;
  risk_level: string;
  exposed_fields: string[];
  catalog_verified: boolean;
}

const PartnerClaimDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState("assigned");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [evidence, setEvidence] = useState<BreachEvidence[]>([]);
  const [application, setApplication] = useState<any>(null);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchAll();
  }, [user, id]);

  const fetchAll = async () => {
    try {
      const { data: pu } = await supabase
        .from("partner_users")
        .select("partner_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();

      if (!pu) { setLoading(false); return; }

      const { data: assignment } = await supabase
        .from("claim_assignments")
        .select("assignment_status")
        .eq("claim_id", id!)
        .eq("partner_id", pu.partner_id)
        .maybeSingle();

      if (assignment) setAssignmentStatus(assignment.assignment_status);

      const [claimRes, historyRes, docsRes, notesRes, appRes] = await Promise.all([
        supabase.from("claims").select("id, status, est_payout, filed_at, updated_at, user_id, settlements(name, company, deadline, description, url)").eq("id", id!).single(),
        supabase.from("claim_status_history").select("*").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_documents").select("id, file_path, file_name, file_type, doc_type, note, created_at, verified").eq("claim_id", id!).order("created_at", { ascending: true }),
        supabase.from("claim_partner_notes").select("id, note, created_at").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_applications").select("*").eq("claim_id", id!).maybeSingle(),
      ]);

      if (claimRes.data) {
        const d = claimRes.data as any;
        setClaim({
          id: d.id, status: d.status, est_payout: d.est_payout ? Number(d.est_payout) : null,
          filed_at: d.filed_at, updated_at: d.updated_at, user_id: d.user_id,
          settlement: { name: d.settlements?.name || "Unknown", company: d.settlements?.company || "", deadline: d.settlements?.deadline, description: d.settlements?.description, url: d.settlements?.url },
        });

        const { data: evidenceData } = await supabase
          .from("breach_events")
          .select("source, breach_year, risk_level, exposed_fields, breach_catalog(verified)")
          .eq("user_id", d.user_id)
          .limit(10);

        if (evidenceData) {
          setEvidence(evidenceData.map((b: any) => ({
            source: b.source, breach_year: b.breach_year, risk_level: b.risk_level,
            exposed_fields: b.exposed_fields || [], catalog_verified: b.breach_catalog?.verified || false,
          })));
        }
      }
      setHistory((historyRes.data as HistoryEntry[]) || []);
      setDocuments((docsRes.data as DocEntry[]) || []);
      setNotes((notesRes.data as NoteEntry[]) || []);
      setApplication(appRes.data || null);
    } catch (error) {
      console.error("Error fetching claim detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClaimStatus = async (newStatus: string) => {
    if (!claim) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("rpc_partner_update_claim_status", {
        p_claim_id: claim.id,
        p_new_status: newStatus,
        p_notes: `Partner updated status to ${newStatus}`,
      });
      if (error) throw error;
      toast.success(`Claim status updated to ${newStatus}`);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAssignment = async (newStatus: string) => {
    if (!claim) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("rpc_partner_update_assignment", {
        p_claim_id: claim.id,
        p_status: newStatus,
      });
      if (error) throw error;
      toast.success(`Assignment updated to ${newStatus}`);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || "Failed to update assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("rpc_partner_add_note", {
        p_claim_id: id,
        p_note: newNote.trim(),
      });
      if (error) throw error;
      setNewNote("");
      toast.success("Note added");
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (filePath: string) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(filePath, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Failed to generate download link");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!claim) return <div className="py-20 text-center text-muted-foreground">Case not found or access denied.</div>;

  return (
    <div>
      <PageHeader title={`Case ${claim.id.slice(0, 8)}…`} subtitle={`${claim.settlement.company} — ${claim.settlement.name}`}>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/partner/claims")}>
          <ArrowLeft className="mr-1 h-3 w-3" />Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settlement Details */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Settlement Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{claim.settlement.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span>{claim.settlement.company}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className={claim.settlement.deadline ? "font-semibold" : ""}>{claim.settlement.deadline || "—"}</span></div>
            {claim.settlement.url && (
              <div className="flex justify-between"><span className="text-muted-foreground">Filing URL</span><a href={claim.settlement.url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs inline-flex items-center gap-0.5">View <ExternalLink className="h-3 w-3" /></a></div>
            )}
            {claim.settlement.description && <p className="text-xs text-muted-foreground pt-2 border-t border-border">{claim.settlement.description}</p>}
          </div>
        </div>

        {/* Case Status & Actions */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Case Status & Actions</h3>
          <div className="flex items-center gap-3">
            <StatusPill variant={claim.status as any} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              assignmentStatus === "completed" ? "bg-success/10 text-success" :
              assignmentStatus === "in_progress" ? "bg-primary/10 text-primary" :
              "bg-muted text-muted-foreground"
            }`}>
              {assignmentStatus.replace("_", " ")}
            </span>
            {claim.est_payout && <span className="text-primary font-semibold">${claim.est_payout.toLocaleString()}</span>}
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Assignment Progress</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleUpdateAssignment("in_progress")} disabled={submitting || assignmentStatus === "in_progress"}>
                  <Play className="mr-1 h-3 w-3" />Start Work
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleUpdateAssignment("completed")} disabled={submitting || assignmentStatus === "completed"}>
                  <SquareCheck className="mr-1 h-3 w-3" />Complete
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Claim Actions</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleUpdateClaimStatus("documentation_required")} disabled={submitting}>
                  <FileText className="mr-1 h-3 w-3" />Request Docs
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleUpdateClaimStatus("under_review")} disabled={submitting}>
                  <CheckCircle className="mr-1 h-3 w-3" />Mark Under Review
                </Button>
                <Button size="sm" className="rounded-xl" onClick={() => handleUpdateClaimStatus("approved")} disabled={submitting || claim.status === "approved" || claim.status === "paid"}>
                  <ThumbsUp className="mr-1 h-3 w-3" />Recommend Approve
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Eligibility Answers (read-only) */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Eligibility Answers
          </h3>
          {!application ? (
            <p className="text-sm text-muted-foreground">No application data on file</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Name</p>
                  <p className="font-medium">{application.full_name || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Email</p>
                  <p className="font-medium truncate">{application.email || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Phone</p>
                  <p className="font-medium">{application.phone || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Address</p>
                  <p className="font-medium">{application.address || "—"}</p>
                </div>
              </div>
              {application.eligibility_answers && Object.keys(application.eligibility_answers).length > 0 && (
                <div className="rounded-lg border p-3 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Eligibility Responses</p>
                  {Object.entries(application.eligibility_answers).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</span>
                      <span className="font-medium">{typeof value === "boolean" ? (value ? "✅ Yes" : "❌ No") : String(value) || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
              {application.breach_experience && (
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Experience Description</p>
                  <p className="text-sm">{application.breach_experience}</p>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Certifications: {application.certifications_signed ? "✅ Signed" : "❌ Not signed"}</span>
                <span>Docs available: {application.documentation_available ? "Yes" : "No"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Breach Evidence */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Breach Evidence</h3>
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No breach evidence on file</p>
          ) : (
            <div className="space-y-2">
              {evidence.map((ev, idx) => (
                <div key={idx} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ev.source}</span>
                      {ev.breach_year && <span className="text-xs text-muted-foreground">({ev.breach_year})</span>}
                      {ev.catalog_verified && (
                        <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle className="h-2.5 w-2.5" /> Verified
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      ev.risk_level === "critical" || ev.risk_level === "high" ? "bg-destructive/10 text-destructive" :
                      ev.risk_level === "medium" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                    }`}>{ev.risk_level}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ev.exposed_fields.map(f => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">{f}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Documents */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Evidence Documents ({documents.length})</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${doc.verified ? "border-success/30 bg-success/5" : "bg-muted/30"}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate max-w-[200px]">{doc.file_name || doc.file_path.split("/").pop()}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="bg-muted px-1.5 py-0.5 rounded capitalize">{doc.doc_type.replace("_", " ")}</span>
                        <span>{format(new Date(doc.created_at), "MMM d")}</span>
                        {doc.verified && <span className="text-success flex items-center gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> Verified</span>}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => handleDownload(doc.file_path)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status History */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Status History</h3>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <StatusPill variant={h.status as any} />
                <div className="flex-1">
                  <p className="text-xs">{h.note || `Status → ${h.status}`}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(h.created_at), "MMM d, h:mm a")}
                    {h.updated_by && ` · ${h.updated_by}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Partner Notes */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Internal Notes</h3>
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border p-3 text-sm">
                <p>{n.note}</p>
                <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, h:mm a")}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add an internal note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="rounded-xl min-h-[60px]"
            />
            <Button size="sm" className="rounded-xl self-end" onClick={handleAddNote} disabled={submitting || !newNote.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerClaimDetail;
