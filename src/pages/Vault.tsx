import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Shield, FileText, Eye, Download, Trash2, Loader2,
  AlertTriangle, CheckCircle, Clock, Image as ImageIcon, Filter,
} from "lucide-react";
import { Link } from "react-router-dom";

interface VaultDoc {
  id: string;
  claim_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  doc_type: string;
  status: string;
  user_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  settlement_name?: string;
  settlement_company?: string;
}

const statusOptions = ["all", "uploaded", "verified", "needs_more_info"];
const typeOptions = ["all", "Government ID", "Proof of Address", "Breach Notice", "Receipt/Invoice", "Other"];

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

const Vault = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<VaultDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocs = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("claim_documents")
      .select("id, claim_id, file_path, file_name, file_size, mime_type, doc_type, status, user_notes, admin_notes, created_at, claims(settlement_id, settlements(name, company))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setDocs(data.map((d: any) => ({
        ...d,
        settlement_name: d.claims?.settlements?.name || "Unknown",
        settlement_company: d.claims?.settlements?.company || "",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [user]);

  const filtered = useMemo(() => {
    let list = [...docs];
    if (statusFilter !== "all") list = list.filter(d => d.status === statusFilter);
    if (typeFilter !== "all") list = list.filter(d => d.doc_type === typeFilter);
    return list;
  }, [docs, statusFilter, typeFilter]);

  const handleView = async (doc: VaultDoc) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(doc.file_path, 600);
    if (data?.signedUrl) {
      if (doc.mime_type?.startsWith("image/")) setPreviewUrl(data.signedUrl);
      else window.open(data.signedUrl, "_blank");
    }
  };

  const handleDownload = async (doc: VaultDoc) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(doc.file_path, 600, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    await supabase.storage.from("claim-documents").remove([deleteDoc.file_path]);
    await supabase.from("claim_documents").delete().eq("id", deleteDoc.id);
    setDeleting(false);
    setDeleteDoc(null);
    toast({ title: "Document deleted" });
    fetchDocs();
  };

  return (
    <div>
      <PageHeader title="Evidence Vault" subtitle="All documents across your claims" />

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : statusConfig[s]?.label || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {typeOptions.map(t => (
              <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {docs.length === 0 ? "No documents uploaded yet. Upload evidence from your claim pages." : "No documents match these filters."}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(doc => {
              const cfg = statusConfig[doc.status] || statusConfig.uploaded;
              const StatusIcon = cfg.icon;
              const isImage = doc.mime_type?.startsWith("image/");

              return (
                <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group">
                  {isImage ? <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" /> : <FileText className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>{doc.doc_type}</span>
                      <span>·</span>
                      <span>{formatBytes(doc.file_size)}</span>
                      <span>·</span>
                      <Link to={`/claims/${doc.claim_id}`} className="text-primary hover:underline">{doc.settlement_company} — {doc.settlement_name}</Link>
                      <span>·</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    {doc.status === "needs_more_info" && doc.admin_notes && (
                      <div className="mt-1 rounded-lg bg-warning/10 border border-warning/20 px-2 py-1 text-xs text-warning">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />{doc.admin_notes}
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${cfg.color}`}>
                    <StatusIcon className="h-2.5 w-2.5" />{cfg.label}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleView(doc)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)}><Download className="h-3.5 w-3.5" /></Button>
                    {doc.status === "uploaded" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteDoc(doc)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Privacy */}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
        <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[10px] text-muted-foreground">Files are encrypted at rest. Access controlled by your account.</p>
      </div>

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
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteDoc?.file_name}</span>?
          </p>
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

export default Vault;
