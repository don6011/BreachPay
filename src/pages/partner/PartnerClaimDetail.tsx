import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, FileText, Send, CheckCircle } from "lucide-react";
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

const PartnerClaimDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchAll();
  }, [user, id]);

  const fetchAll = async () => {
    try {
      const [claimRes, historyRes, docsRes, notesRes] = await Promise.all([
        supabase.from("claims").select("id, status, est_payout, filed_at, updated_at, user_id, settlements(name, company, deadline, description, url)").eq("id", id!).single(),
        supabase.from("claim_status_history").select("*").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_documents").select("*").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_partner_notes").select("id, note, created_at").eq("claim_id", id!).order("created_at", { ascending: false }),
      ]);

      if (claimRes.data) {
        const d = claimRes.data as any;
        setClaim({
          id: d.id, status: d.status, est_payout: d.est_payout ? Number(d.est_payout) : null,
          filed_at: d.filed_at, updated_at: d.updated_at, user_id: d.user_id,
          settlement: { name: d.settlements?.name || "Unknown", company: d.settlements?.company || "", deadline: d.settlements?.deadline, description: d.settlements?.description, url: d.settlements?.url },
        });
      }
      if (historyRes.data) setHistory(historyRes.data as HistoryEntry[]);
      if (docsRes.data) setDocuments(docsRes.data as DocEntry[]);
      if (notesRes.data) setNotes(notesRes.data as NoteEntry[]);
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
      await supabase.from("alerts").insert({
        user_id: claim.user_id,
        type: "claim_update" as any,
        title: "Documentation Requested",
        body: `A partner has requested additional documentation for your claim related to ${claim.settlement.name}.`,
        severity: "medium" as any,
        related_claim_id: claim.id,
      });

      await supabase.from("claim_status_history").insert({
        claim_id: claim.id,
        status: "documentation_required",
        note: "Partner requested additional documentation",
        updated_by: "partner",
      });

      await supabase.from("claims").update({ status: "documentation_required" as any }).eq("id", claim.id);

      toast.success("Documentation request sent to user");
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
      await supabase.from("claim_status_history").insert({
        claim_id: claim.id,
        status: "under_review",
        note: "Reviewed by partner",
        updated_by: "partner",
      });
      toast.success("Claim marked as reviewed");
      fetchAll();
    } catch (error) {
      toast.error("Failed to mark as reviewed");
    } finally {
      setSubmitting(false);
    }
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!claim) {
    return <div className="py-20 text-center text-muted-foreground">Claim not found or access denied.</div>;
  }

  return (
    <div>
      <PageHeader title={`Claim ${claim.id.slice(0, 8)}…`} subtitle={claim.settlement.name}>
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
            <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span>{claim.settlement.deadline || "—"}</span></div>
            {claim.settlement.url && (
              <div className="flex justify-between"><span className="text-muted-foreground">URL</span><a href={claim.settlement.url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">View</a></div>
            )}
            {claim.settlement.description && <p className="text-xs text-muted-foreground pt-2">{claim.settlement.description}</p>}
          </div>
        </div>

        {/* Claim Status & Actions */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Claim Status</h3>
          <div className="flex items-center gap-3">
            <StatusPill variant={claim.status as any} />
            {claim.est_payout && <span className="text-primary font-semibold">${claim.est_payout.toLocaleString()}</span>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRequestDocumentation} disabled={submitting}>
              <FileText className="mr-1 h-3 w-3" />Request Docs
            </Button>
            <Button size="sm" className="rounded-xl" onClick={handleMarkReviewed} disabled={submitting}>
              <CheckCircle className="mr-1 h-3 w-3" />Mark Reviewed
            </Button>
          </div>
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

        {/* Documents */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Documents</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium truncate max-w-[200px]">{doc.file_path.split("/").pop()}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.file_type || "file"} · {format(new Date(doc.created_at), "MMM d")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.verified && <span className="text-[10px] text-success font-semibold">Verified</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Partner Notes */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Partner Notes</h3>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note about this claim..."
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
