import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Upload, FileText, Trash2, Download, Eye, Shield, Loader2,
  AlertTriangle, CheckCircle, Clock, Image as ImageIcon,
} from "lucide-react";

const DOC_TYPES = [
  "Government ID",
  "Proof of Address",
  "Breach Notice",
  "Receipt/Invoice",
  "Other",
];

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface DocRow {
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
  verified: boolean;
}

interface EvidenceVaultProps {
  claimId: string;
  documents: DocRow[];
  onRefresh: () => void;
  claimStatus?: string;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string }> = {
  uploaded: { icon: Clock, color: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20" },
  verified: { icon: CheckCircle, color: "bg-success/15 text-success border-success/20" },
  needs_more_info: { icon: AlertTriangle, color: "bg-warning/15 text-warning border-warning/20" },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function EvidenceVault({ claimId, documents, onRefresh, claimStatus }: EvidenceVaultProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [userNotes, setUserNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!user) return;
    setUploading(true);

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file type", description: "Only PDF, JPG, and PNG files are accepted.", variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
        continue;
      }

      const docId = crypto.randomUUID();
      const filePath = `${user.id}/${claimId}/${docId}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("claim-documents")
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { error: insertError } = await supabase.from("claim_documents").insert({
        claim_id: claimId,
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        doc_type: docType,
        status: "uploaded",
        user_notes: userNotes || null,
      });

      if (insertError) {
        toast({ title: "Error saving document", description: insertError.message, variant: "destructive" });
        continue;
      }

      // Create alert for document upload
      await supabase.from("alerts").insert({
        user_id: user.id,
        type: "claim_update",
        title: "Document uploaded",
        body: `${file.name} (${docType}) uploaded for your claim.`,
        severity: "low",
        related_claim_id: claimId,
      });
    }

    setUserNotes("");
    setUploading(false);
    toast({ title: "Documents uploaded", description: "Your evidence has been securely stored." });
    onRefresh();
  }, [user, claimId, docType, userNotes, onRefresh]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleView = async (doc: DocRow) => {
    const { data } = await supabase.storage
      .from("claim-documents")
      .createSignedUrl(doc.file_path, 600);

    if (data?.signedUrl) {
      if (doc.mime_type?.startsWith("image/")) {
        setPreviewUrl(data.signedUrl);
        setPreviewType("image");
      } else {
        window.open(data.signedUrl, "_blank");
      }
    } else {
      toast({ title: "Error", description: "Could not generate preview URL.", variant: "destructive" });
    }
  };

  const handleDownload = async (doc: DocRow) => {
    const { data } = await supabase.storage
      .from("claim-documents")
      .createSignedUrl(doc.file_path, 600, { download: true });

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);

    await supabase.storage.from("claim-documents").remove([deleteDoc.file_path]);
    await supabase.from("claim_documents").delete().eq("id", deleteDoc.id);

    setDeleting(false);
    setDeleteDoc(null);
    toast({ title: "Document deleted" });
    onRefresh();
  };

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Evidence Vault
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload supporting documents to strengthen your claim. PDF/JPG/PNG accepted.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{documents.length} file{documents.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Upload controls */}
      <div className="flex flex-wrap gap-2">
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="w-44 rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map(dt => (
              <SelectItem key={dt} value={dt}>{dt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Optional notes about this document…"
          value={userNotes}
          onChange={e => setUserNotes(e.target.value)}
          className="flex-1 min-w-[200px] h-9 min-h-[36px] rounded-xl text-xs resize-none"
          rows={1}
        />
      </div>

      {/* Drag & drop zone */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        onChange={handleFileInput}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-all group cursor-pointer disabled:opacity-50 ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"
        }`}
      >
        {uploading ? (
          <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
        ) : (
          <Upload className="mx-auto h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
        )}
        <p className="text-sm font-medium">{uploading ? "Uploading…" : "Drop files here or click to upload"}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Type: <span className="text-primary font-medium">{docType}</span> · Max 10 MB
        </p>
      </button>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map(doc => {
            const cfg = statusConfig[doc.status] || statusConfig.uploaded;
            const StatusIcon = cfg.icon;
            const isImage = doc.mime_type?.startsWith("image/");

            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 group">
                <div className="shrink-0">
                  {isImage ? <ImageIcon className="h-5 w-5 text-muted-foreground" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.doc_type}</span>
                    <span>·</span>
                    <span>{formatBytes(doc.file_size)}</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  {doc.status === "needs_more_info" && doc.admin_notes && (
                    <div className="mt-1 rounded-lg bg-warning/10 border border-warning/20 px-2 py-1 text-xs text-warning">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />{doc.admin_notes}
                    </div>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {doc.status === "needs_more_info" ? "Needs Info" : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleView(doc)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {doc.status === "uploaded" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteDoc(doc)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
        <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[10px] text-muted-foreground">Files are encrypted at rest. Access controlled by your account.</p>
      </div>

      {/* Image preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={open => !open && setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && previewType === "image" && (
            <img src={previewUrl} alt="Document preview" className="w-full rounded-xl" />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteDoc} onOpenChange={open => !open && setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteDoc?.file_name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
