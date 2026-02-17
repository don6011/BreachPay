import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  FileText, Eye, Download, Trash2, Loader2, Search,
  AlertTriangle, CheckCircle, Clock, ShieldCheck, MessageSquareWarning,
  Image as ImageIcon,
} from "lucide-react";

interface AdminDoc {
  id: string;
  claim_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  doc_type: string;
  status: string;
  user_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  settlement_name?: string;
  settlement_company?: string;
}

const statusOptions = ["all", "uploaded", "verified", "needs_more_info"];
const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  uploaded: { icon: Clock, color: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20", label: "Uploaded" },
  verified: { icon: CheckCircle, color: "bg-success/15 text-success border-success/20", label: "Verified" },
  needs_more_info: { icon: AlertTriangle, color: "bg-warning/15 text-warning border-warning/20", label: "Needs Info" },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const AdminDocuments = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<AdminDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Action modal
  const [actionDoc, setActionDoc] = useState<AdminDoc | null>(null);
  const [actionType, setActionType] = useState<"verified" | "needs_more_info">("verified");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("claim_documents")
      .select("id, claim_id, user_id, file_path, file_name, file_size, mime_type, doc_type, status, user_notes, admin_notes, created_at, updated_at, claims(settlement_id, settlements(name, company))")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data) {
      // Fetch user emails
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("user_profiles").select("user_id, email").in("user_id", userIds)
        : { data: [] };

      const emailMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { emailMap[p.user_id] = p.email || `user-${p.user_id.slice(0, 6)}`; });

      setDocs(data.map((d: any) => ({
        ...d,
        user_email: emailMap[d.user_id] || `user-${d.user_id.slice(0, 6)}`,
        settlement_name: d.claims?.settlements?.name || "Unknown",
        settlement_company: d.claims?.settlements?.company || "",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const filtered = useMemo(() => {
    let list = [...docs];
    if (statusFilter !== "all") list = list.filter(d => d.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.file_name.toLowerCase().includes(q) ||
        d.user_email?.toLowerCase().includes(q) ||
        d.settlement_company?.toLowerCase().includes(q) ||
        d.settlement_name?.toLowerCase().includes(q) ||
        d.claim_id.includes(q)
      );
    }
    return list;
  }, [docs, statusFilter, searchQuery]);

  const handleView = async (doc: AdminDoc) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(doc.file_path, 600);
    if (data?.signedUrl) {
      if (doc.mime_type?.startsWith("image/")) setPreviewUrl(data.signedUrl);
      else window.open(data.signedUrl, "_blank");
    }
  };

  const handleDownload = async (doc: AdminDoc) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(doc.file_path, 600, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    await supabase.storage.from("claim-documents").remove([deleteDoc.file_path]);
    await supabase.from("claim_documents").delete().eq("id", deleteDoc.id);

    // Log activity
    if (user) {
      await supabase.from("admin_activity_logs").insert({
        admin_user_id: user.id,
        action: "Deleted claim document",
        entity_type: "claim_document",
        entity_id: deleteDoc.id,
        meta: { file_name: deleteDoc.file_name, claim_id: deleteDoc.claim_id },
      });
    }

    setDeleting(false);
    setDeleteDoc(null);
    toast({ title: "Document deleted" });
    fetchDocs();
  };

  const handleStatusChange = async () => {
    if (!actionDoc || !user) return;
    setSaving(true);

    const updates: Record<string, any> = {
      status: actionType,
      admin_notes: actionType === "needs_more_info" ? adminNote : (actionDoc.admin_notes || null),
      verified: actionType === "verified",
      verified_at: actionType === "verified" ? new Date().toISOString() : null,
      verified_by: actionType === "verified" ? user.id : null,
    };

    const { error } = await supabase
      .from("claim_documents")
      .update(updates)
      .eq("id", actionDoc.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Create alert for user
    if (actionType === "verified") {
      await supabase.from("alerts").insert({
        user_id: actionDoc.user_id,
        type: "payout_update",
        title: "Document verified",
        body: `Your document "${actionDoc.file_name}" has been verified.`,
        severity: "low",
        related_claim_id: actionDoc.claim_id,
      });
    } else {
      await supabase.from("alerts").insert({
        user_id: actionDoc.user_id,
        type: "claim_update",
        title: "More documentation required",
        body: adminNote || "Additional information is needed for your uploaded document.",
        severity: "high",
        related_claim_id: actionDoc.claim_id,
      });
    }

    // Activity log
    await supabase.from("admin_activity_logs").insert({
      admin_user_id: user.id,
      action: `Set document status to ${actionType}`,
      entity_type: "claim_document",
      entity_id: actionDoc.id,
      meta: { file_name: actionDoc.file_name, claim_id: actionDoc.claim_id, status: actionType, note: adminNote || null },
    });

    setSaving(false);
    setActionDoc(null);
    setAdminNote("");
    toast({ title: `Document marked as ${actionType === "verified" ? "Verified" : "Needs More Info"}` });
    fetchDocs();
  };

  const counts = {
    total: docs.length,
    uploaded: docs.filter(d => d.status === "uploaded").length,
    verified: docs.filter(d => d.status === "verified").length,
    needs_more_info: docs.filter(d => d.status === "needs_more_info").length,
  };

  return (
    <div>
      <PageHeader title="Document Review" subtitle="Review and verify claim evidence submissions" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Documents</p>
          <p className="text-2xl font-bold">{counts.total}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending Review</p>
          <p className="text-2xl font-bold text-warning">{counts.uploaded}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-1">Verified</p>
          <p className="text-2xl font-bold text-success">{counts.verified}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-1">Needs More Info</p>
          <p className="text-2xl font-bold text-critical">{counts.needs_more_info}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by file, user, settlement…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : statusConfig[s]?.label || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">File</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Uploaded</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No documents found</td></tr>
            ) : (
              filtered.map(doc => {
                const cfg = statusConfig[doc.status] || statusConfig.uploaded;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {doc.mime_type?.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="font-medium truncate max-w-[160px]">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[140px]">{doc.user_email}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium">{doc.settlement_company}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.settlement_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{doc.doc_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                        <StatusIcon className="h-2.5 w-2.5" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleView(doc)} title="View">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-success" title="Verify"
                          onClick={() => { setActionDoc(doc); setActionType("verified"); setAdminNote(""); }}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-warning" title="Needs More Info"
                          onClick={() => { setActionDoc(doc); setActionType("needs_more_info"); setAdminNote(""); }}>
                          <MessageSquareWarning className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete"
                          onClick={() => setDeleteDoc(doc)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Action modal */}
      <Dialog open={!!actionDoc} onOpenChange={open => { if (!open) { setActionDoc(null); setAdminNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "verified" ? "Verify Document" : "Request More Information"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionType === "verified"
                ? `Mark "${actionDoc?.file_name}" as verified? This will notify the user.`
                : `Request more information for "${actionDoc?.file_name}"? The user will be alerted.`}
            </p>
            {actionType === "needs_more_info" && (
              <Textarea
                placeholder="Explain what additional information is needed…"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                className="rounded-xl"
                rows={3}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDoc(null)}>Cancel</Button>
            <Button
              onClick={handleStatusChange}
              disabled={saving || (actionType === "needs_more_info" && !adminNote.trim())}
              className={actionType === "verified" ? "bg-success hover:bg-success/90" : ""}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {actionType === "verified" ? "Verify" : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      <Dialog open={!!previewUrl} onOpenChange={open => !open && setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Document Preview</DialogTitle></DialogHeader>
          {previewUrl && <img src={previewUrl} alt="Preview" className="w-full rounded-xl" />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteDoc} onOpenChange={open => !open && setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Permanently delete <span className="font-semibold text-foreground">{deleteDoc?.file_name}</span>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDocuments;
