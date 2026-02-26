import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, FileText, Send, CheckCircle, ExternalLink, ClipboardList, MessageSquare, FilePlus, Eye, EyeOff } from "lucide-react";
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
interface NoteEntry { id: string; note: string; visibility: string; created_at: string; }
interface DocRequest { id: string; request_type: string; message: string | null; status: string; created_at: string; fulfilled_at: string | null; }

const REQUEST_TYPES = [
  { value: "breach_notice", label: "Breach Notice" },
  { value: "receipt", label: "Receipt" },
  { value: "identity_verification", label: "Identity Verification" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "other", label: "Other" },
];

const PartnerClaimDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState("assigned");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [docRequests, setDocRequests] = useState<DocRequest[]>([]);
  const [application, setApplication] = useState<any>(null);
  const [newNote, setNewNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "user_visible">("internal");
  const [reqType, setReqType] = useState("breach_notice");
  const [reqMessage, setReqMessage] = useState("");
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

      const [claimRes, historyRes, docsRes, notesRes, appRes, docReqRes] = await Promise.all([
        supabase.from("claims").select("id, status, est_payout, filed_at, updated_at, user_id, settlements(name, company, deadline, description, url)").eq("id", id!).single(),
        supabase.from("claim_status_history").select("*").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_documents").select("id, file_path, file_name, file_type, doc_type, note, created_at, verified").eq("claim_id", id!).order("created_at", { ascending: true }),
        supabase.from("claim_partner_notes").select("id, note, visibility, created_at").eq("claim_id", id!).order("created_at", { ascending: false }),
        supabase.from("claim_applications").select("*").eq("claim_id", id!).maybeSingle(),
        supabase.from("claim_doc_requests").select("id, request_type, message, status, created_at, fulfilled_at").eq("claim_id", id!).order("created_at", { ascending: false }),
      ]);

      if (claimRes.data) {
        const d = claimRes.data as any;
        setClaim({
          id: d.id, status: d.status, est_payout: d.est_payout ? Number(d.est_payout) : null,
          filed_at: d.filed_at, updated_at: d.updated_at, user_id: d.user_id,
          settlement: { name: d.settlements?.name || "Unknown", company: d.settlements?.company || "", deadline: d.settlements?.deadline, description: d.settlements?.description, url: d.settlements?.url },
        });
      }
      setHistory((historyRes.data as HistoryEntry[]) || []);
      setDocuments((docsRes.data as DocEntry[]) || []);
      setNotes((notesRes.data as NoteEntry[]) || []);
      setApplication(appRes.data || null);
      setDocRequests((docReqRes.data as DocRequest[]) || []);
    } catch (error) {
      console.error("Error fetching claim detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("rpc_partner_add_claim_note", {
        p_claim_id: id,
        p_note: newNote.trim(),
        p_visibility: noteVisibility,
      });
      if (error) throw error;
      setNewNote("");
      toast.success(noteVisibility === "user_visible" ? "Note added (visible to user)" : "Internal note added");
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDoc = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("rpc_partner_request_document", {
        p_claim_id: id,
        p_request_type: reqType,
        p_message: reqMessage.trim() || null,
      });
      if (error) throw error;
      setReqMessage("");
      toast.success("Document request sent to user");
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || "Failed to request document");
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
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/partner")}>
          <ArrowLeft className="mr-1 h-3 w-3" />Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1) Claim Summary (read-only) */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Claim Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Settlement</span><span className="font-medium">{claim.settlement.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span>{claim.settlement.company}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusPill variant={claim.status as any} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Assignment</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                assignmentStatus === "completed" ? "bg-success/10 text-success" :
                assignmentStatus === "in_progress" ? "bg-primary/10 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>{assignmentStatus.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className={claim.settlement.deadline ? "font-semibold" : ""}>{claim.settlement.deadline || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Est. Payout</span><span className="text-primary font-semibold">{claim.est_payout ? `$${claim.est_payout.toLocaleString()}` : "—"}</span></div>
            {claim.settlement.url && (
              <div className="flex justify-between"><span className="text-muted-foreground">Filing URL</span><a href={claim.settlement.url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs inline-flex items-center gap-0.5">View <ExternalLink className="h-3 w-3" /></a></div>
            )}
            {claim.settlement.description && <p className="text-xs text-muted-foreground pt-2 border-t border-border">{claim.settlement.description}</p>}
          </div>
        </div>

        {/* 2) Eligibility Answers (read-only) */}
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
            </div>
          )}
        </div>

        {/* 3) Evidence Vault (read-only) */}
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

        {/* Status History (read-only) */}
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

        {/* 4) Partner Notes */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Partner Notes
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet</p>
            ) : notes.map((n) => (
              <div key={n.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, h:mm a")}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                    n.visibility === "user_visible" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {n.visibility === "user_visible" ? <><Eye className="h-2.5 w-2.5" /> User visible</> : <><EyeOff className="h-2.5 w-2.5" /> Internal</>}
                  </span>
                </div>
                <p>{n.note}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              placeholder="Add a note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="rounded-xl min-h-[60px]"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="note-visibility"
                  checked={noteVisibility === "user_visible"}
                  onCheckedChange={(checked) => setNoteVisibility(checked ? "user_visible" : "internal")}
                />
                <Label htmlFor="note-visibility" className="text-xs cursor-pointer">
                  {noteVisibility === "user_visible" ? "User visible" : "Internal only"}
                </Label>
              </div>
              <Button size="sm" className="rounded-xl" onClick={handleAddNote} disabled={submitting || !newNote.trim()}>
                <Send className="h-3 w-3 mr-1" /> Add Note
              </Button>
            </div>
          </div>
        </div>

        {/* 5) Request Documents */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FilePlus className="h-4 w-4" /> Document Requests
          </h3>

          {/* Existing requests */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {docRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No document requests yet</p>
            ) : docRequests.map((dr) => (
              <div key={dr.id} className={`rounded-lg border p-3 text-sm ${
                dr.status === "fulfilled" ? "border-success/30 bg-success/5" : dr.status === "cancelled" ? "opacity-50" : ""
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium capitalize">{dr.request_type.replace(/_/g, " ")}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    dr.status === "fulfilled" ? "bg-success/10 text-success" :
                    dr.status === "cancelled" ? "bg-muted text-muted-foreground" :
                    "bg-warning/10 text-warning"
                  }`}>{dr.status}</span>
                </div>
                {dr.message && <p className="text-xs text-muted-foreground">{dr.message}</p>}
                <span className="text-[10px] text-muted-foreground">{format(new Date(dr.created_at), "MMM d, h:mm a")}</span>
                {dr.fulfilled_at && <span className="text-[10px] text-success ml-2">Fulfilled {format(new Date(dr.fulfilled_at), "MMM d")}</span>}
              </div>
            ))}
          </div>

          {/* New request form */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Select value={reqType} onValueChange={setReqType}>
                <SelectTrigger className="w-48 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Optional message to the user…"
                value={reqMessage}
                onChange={(e) => setReqMessage(e.target.value)}
                className="rounded-xl min-h-[40px] flex-1"
                rows={1}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="rounded-xl" onClick={handleRequestDoc} disabled={submitting}>
                <FilePlus className="h-3 w-3 mr-1" /> Request Document
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerClaimDetail;
