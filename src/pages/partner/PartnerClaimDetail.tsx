import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, FileText, Send, CheckCircle, Shield, ExternalLink, ListTodo, AlertTriangle, ThumbsUp } from "lucide-react";
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

interface HistoryEntry { id: string; status: string; note: string | null; created_at: string; updated_by: string | null; }
interface DocEntry { id: string; file_path: string; file_type: string | null; note: string | null; created_at: string; verified: boolean; }
interface NoteEntry { id: string; note: string; created_at: string; }
interface TaskEntry { id: string; task_type: string; status: string; details: string | null; created_at: string; completed_at: string | null; assigned_to_role: string; }

interface BreachEvidence {
  source: string;
  breach_year: number | null;
  risk_level: string;
  exposed_fields: string[];
  catalog_verified: boolean;
  source_type: string | null;
  source_name: string | null;
}

const taskTypeLabels: Record<string, string> = {
  request_docs: "Request Documentation",
  review: "Case Review",
  verify_identity: "Identity Verification",
  payout_ready: "Payout Ready",
  admin_review: "Admin Review",
};

const PartnerClaimDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [evidence, setEvidence] = useState<BreachEvidence[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchAll();
  }, [user, id]);

  const fetchAll = async () => {
    try {
      const [claimRes, historyRes, docsRes, notesRes, tasksRes] = await Promise.all([
        supabase.from("claims").select("id, status, est_payout, filed_at, updated_at, user_id, settlements(name, company, deadline, description, url)").eq("id", id!).single(),
        supabase.from("claim_status_history").select("*").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_documents").select("*").eq("claim_id", id!).order("created_at", { ascending: true }),
        supabase.from("claim_partner_notes").select("id, note, created_at").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_tasks").select("*").eq("claim_id", id!).order("created_at", { ascending: false }),
      ]);

      if (claimRes.data) {
        const d = claimRes.data as any;
        setClaim({
          id: d.id, status: d.status, est_payout: d.est_payout ? Number(d.est_payout) : null,
          filed_at: d.filed_at, updated_at: d.updated_at, user_id: d.user_id,
          settlement: { name: d.settlements?.name || "Unknown", company: d.settlements?.company || "", deadline: d.settlements?.deadline, description: d.settlements?.description, url: d.settlements?.url },
        });

        // Fetch breach evidence for this user
        const { data: evidenceData } = await supabase
          .from("breach_events")
          .select("source, breach_year, risk_level, exposed_fields, breach_catalog(verified, source_type, source_name)")
          .eq("user_id", d.user_id)
          .limit(10);

        if (evidenceData) {
          setEvidence(evidenceData.map((b: any) => ({
            source: b.source,
            breach_year: b.breach_year,
            risk_level: b.risk_level,
            exposed_fields: b.exposed_fields || [],
            catalog_verified: b.breach_catalog?.verified || false,
            source_type: b.breach_catalog?.source_type || null,
            source_name: b.breach_catalog?.source_name || null,
          })));
        }
      }
      setHistory((historyRes.data as HistoryEntry[]) || []);
      setDocuments((docsRes.data as DocEntry[]) || []);
      setNotes((notesRes.data as NoteEntry[]) || []);
      setTasks((tasksRes.data as TaskEntry[]) || []);
    } catch (error) {
      console.error("Error fetching claim detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDocumentation = async () => {
    if (!claim || !user) return;
    setSubmitting(true);
    try {
      // Create task
      await supabase.from("claim_tasks").insert({
        claim_id: claim.id,
        assigned_to_role: "user",
        task_type: "request_docs",
        details: "Partner requested additional documentation",
      });

      // Update claim status
      await supabase.from("claims").update({ status: "documentation_required" as any }).eq("id", claim.id);

      // Status history
      await supabase.from("claim_status_history").insert({
        claim_id: claim.id,
        status: "documentation_required",
        note: "Partner requested additional documentation",
        updated_by: "partner",
      });

      // Alert user
      await supabase.from("alerts").insert({
        user_id: claim.user_id,
        type: "claim_update" as any,
        title: "Documentation Requested",
        body: `Additional documentation has been requested for your case related to ${claim.settlement.name}. Please upload the required documents.`,
        severity: "medium" as any,
        related_claim_id: claim.id,
      });

      toast.success("Documentation request sent to claimant");
      fetchAll();
    } catch (error) {
      toast.error("Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!claim || !user) return;
    setSubmitting(true);
    try {
      // Mark review task done
      const reviewTask = tasks.find(t => t.task_type === "review" && t.status === "open");
      if (reviewTask) {
        await supabase.from("claim_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", reviewTask.id);
      }

      await supabase.from("claim_status_history").insert({
        claim_id: claim.id,
        status: claim.status,
        note: "Partner review completed",
        updated_by: "partner",
      });

      toast.success("Case marked as reviewed");
      fetchAll();
    } catch (error) {
      toast.error("Failed to mark as reviewed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecommendApprove = async () => {
    if (!claim || !user) return;
    setSubmitting(true);
    try {
      // Status history
      await supabase.from("claim_status_history").insert({
        claim_id: claim.id,
        status: claim.status,
        note: "Partner recommended approval — pending admin review",
        updated_by: "partner",
      });

      // Create admin task
      await supabase.from("claim_tasks").insert({
        claim_id: claim.id,
        assigned_to_role: "admin",
        task_type: "payout_ready",
        details: "Partner has reviewed and recommends approval",
      });

      toast.success("Approval recommendation submitted to admin");
      fetchAll();
    } catch (error) {
      toast.error("Failed to submit recommendation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setSubmitting(true);
    try {
      await supabase.from("claim_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", taskId);
      toast.success("Task completed");
      fetchAll();
    } catch { toast.error("Failed to complete task"); }
    finally { setSubmitting(false); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !id) return;
    setSubmitting(true);
    try {
      await supabase.from("claim_partner_notes").insert({
        claim_id: id,
        partner_id: user.id,
        note: newNote.trim(),
      });
      setNewNote("");
      toast.success("Note added");
      fetchAll();
    } catch (error) {
      toast.error("Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (filePath: string) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(filePath, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Failed to generate download link");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!claim) {
    return <div className="py-20 text-center text-muted-foreground">Case not found or access denied.</div>;
  }

  const openTasks = tasks.filter(t => t.status === "open");
  const doneTasks = tasks.filter(t => t.status === "done");

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
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Case Status</h3>
          <div className="flex items-center gap-3">
            <StatusPill variant={claim.status as any} />
            {claim.est_payout && <span className="text-primary font-semibold">${claim.est_payout.toLocaleString()}</span>}
          </div>

          {/* Progress tracker */}
          <div className="flex items-center gap-1 text-[10px] font-medium">
            {["submitted", "under_review", "approved", "paid"].map((step, i) => {
              const statusOrder = ["submitted", "under_review", "documentation_required", "approved", "rejected", "paid"];
              const current = statusOrder.indexOf(claim.status);
              const stepIdx = statusOrder.indexOf(step);
              const active = stepIdx <= current;
              return (
                <div key={step} className="flex items-center gap-1">
                  {i > 0 && <div className={`h-px w-4 ${active ? "bg-primary" : "bg-border"}`} />}
                  <span className={`px-2 py-1 rounded-full ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {step === "under_review" ? "Review" : step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRequestDocumentation} disabled={submitting}>
              <FileText className="mr-1 h-3 w-3" />Request Docs
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={handleMarkReviewed} disabled={submitting}>
              <CheckCircle className="mr-1 h-3 w-3" />Mark Reviewed
            </Button>
            <Button size="sm" className="rounded-xl" onClick={handleRecommendApprove} disabled={submitting || claim.status === "approved" || claim.status === "paid"}>
              <ThumbsUp className="mr-1 h-3 w-3" />Recommend Approve
            </Button>
          </div>
        </div>

        {/* Breach Credibility Summary */}
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
                  {ev.source_type && <p className="text-[10px] text-muted-foreground">Source: {ev.source_type}{ev.source_name ? `: ${ev.source_name}` : ""}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Evidence Documents ({documents.length})</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded by claimant</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${doc.verified ? "border-success/30 bg-success/5" : "bg-muted/30"}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate max-w-[200px]">{doc.note || doc.file_path.split("/").pop()}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {doc.file_type && <span className="bg-muted px-1.5 py-0.5 rounded">{doc.file_type}</span>}
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

        {/* Tasks Panel */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ListTodo className="h-4 w-4" /> Tasks ({openTasks.length} open)
          </h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks</p>
          ) : (
            <div className="space-y-2">
              {openTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-warning/20 bg-warning/5 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">{taskTypeLabels[t.task_type] || t.task_type}</p>
                    {t.details && <p className="text-[10px] text-muted-foreground">{t.details}</p>}
                    <span className="text-[10px] text-muted-foreground">{format(new Date(t.created_at), "MMM d")} · {t.assigned_to_role}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleCompleteTask(t.id)} disabled={submitting}>
                    <CheckCircle className="mr-1 h-3 w-3" />Done
                  </Button>
                </div>
              ))}
              {doneTasks.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Completed</p>
                  {doneTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-success" />
                      <span>{taskTypeLabels[t.task_type] || t.task_type}</span>
                      {t.completed_at && <span className="text-[10px]">· {format(new Date(t.completed_at), "MMM d")}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status History Timeline */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Status History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet</p>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 border-l-2 border-border pl-4 pb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <StatusPill variant={h.status as any} />
                      <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), "MMM d, yyyy h:mm a")}</span>
                    </div>
                    {h.note && <p className="text-xs text-muted-foreground mt-1">{h.note}</p>}
                    {h.updated_by && <span className="text-[10px] text-muted-foreground/60">by {h.updated_by}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Partner Notes */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Internal Notes</h3>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a case note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="rounded-xl text-sm min-h-[60px]"
            />
            <Button size="sm" className="rounded-xl self-end" onClick={handleAddNote} disabled={submitting || !newNote.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
          {notes.length > 0 && (
            <div className="space-y-2 pt-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-sm">{n.note}</p>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, yyyy h:mm a")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerClaimDetail;
