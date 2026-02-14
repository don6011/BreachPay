import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Flag, Edit2, FileText, CheckCircle, ExternalLink, Shield, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";

type ClaimStatusT = "submitted" | "under_review" | "documentation_required" | "approved" | "rejected" | "paid";

interface ClaimRow {
  id: string;
  settlement_name: string;
  status: string;
  est_payout: number;
  filed_at: string | null;
  updated_at: string;
  user_email: string | null;
  user_id: string;
}

interface ClaimDoc {
  id: string;
  file_path: string;
  file_type: string | null;
  note: string | null;
  created_at: string;
  verified: boolean;
}

const FEE_PERCENT = 15;

const AdminClaims = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null);
  const [newStatus, setNewStatus] = useState<ClaimStatusT>("submitted");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  // Payout fields
  const [payoutActual, setPayoutActual] = useState("");

  // Document review
  const [docs, setDocs] = useState<ClaimDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchClaims();
  }, [user]);

  const fetchClaims = async () => {
    try {
      const { data } = await supabase
        .from("claims")
        .select(`id, status, est_payout, filed_at, updated_at, user_id, settlements(name)`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) {
        const userIds = [...new Set(data.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, email")
          .in("user_id", userIds);

        const emailMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { emailMap[p.user_id] = p.email || ""; });

        setClaims(data.map((c: any) => ({
          id: c.id,
          settlement_name: c.settlements?.name || "Unknown",
          status: c.status,
          est_payout: Number(c.est_payout) || 0,
          filed_at: c.filed_at,
          updated_at: c.updated_at,
          user_email: emailMap[c.user_id] || "—",
          user_id: c.user_id,
        })));
      }
    } catch (error) {
      console.error("Error fetching admin claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const openClaimDialog = async (claim: ClaimRow) => {
    setSelectedClaim(claim);
    setNewStatus(claim.status as ClaimStatusT);
    setNote("");
    setPayoutActual("");
    setLoadingDocs(true);

    const { data } = await supabase
      .from("claim_documents")
      .select("id, file_path, file_type, note, created_at, verified")
      .eq("claim_id", claim.id)
      .order("created_at", { ascending: true });

    setDocs((data as ClaimDoc[]) || []);
    setLoadingDocs(false);
  };

  const handleStatusUpdate = async () => {
    if (!selectedClaim || !newStatus) return;
    setUpdating(true);
    try {
      const updatePayload: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // When approving or paying, calculate payout breakdown
      if ((newStatus === "approved" || newStatus === "paid") && payoutActual) {
        const actual = parseFloat(payoutActual);
        if (!isNaN(actual) && actual > 0) {
          const fee = Math.round(actual * (FEE_PERCENT / 100) * 100) / 100;
          const net = Math.round((actual - fee) * 100) / 100;
          updatePayload.final_payout = actual;
          updatePayload.platform_fee = fee;
          updatePayload.net_payout = net;
        }
      }

      // If paying, also create payout record
      if (newStatus === "paid" && payoutActual) {
        const actual = parseFloat(payoutActual);
        const fee = Math.round(actual * (FEE_PERCENT / 100) * 100) / 100;
        const net = Math.round((actual - fee) * 100) / 100;

        await supabase.from("payouts").insert({
          claim_id: selectedClaim.id,
          user_id: selectedClaim.user_id,
          amount: net,
          status: "paid",
          paid_at: new Date().toISOString(),
        });
      }

      const { error: updateError } = await supabase
        .from("claims")
        .update(updatePayload)
        .eq("id", selectedClaim.id);
      if (updateError) throw updateError;

      await supabase.from("claim_status_history").insert({
        claim_id: selectedClaim.id,
        status: newStatus,
        note: note || (payoutActual ? `Payout: $${payoutActual} (Fee: ${FEE_PERCENT}%)` : null),
        updated_by: user?.email || "admin",
      });

      toast.success("Claim status updated");
      setClaims(claims.map(c =>
        c.id === selectedClaim.id ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c
      ));
      setSelectedClaim(null);
    } catch (error) {
      console.error("Error updating claim:", error);
      toast.error("Failed to update claim status");
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyDoc = async (docId: string, verified: boolean) => {
    setVerifyingId(docId);
    try {
      const { error } = await supabase
        .from("claim_documents")
        .update({ verified, verified_by: verified ? user?.id : null, verified_at: verified ? new Date().toISOString() : null })
        .eq("id", docId);
      if (error) throw error;
      setDocs(docs.map(d => d.id === docId ? { ...d, verified } : d));
      if (selectedClaim) {
        await supabase.from("claim_status_history").insert({
          claim_id: selectedClaim.id, status: selectedClaim.status,
          note: `Document ${verified ? "verified" : "unverified"} by admin`, updated_by: user?.email || "admin",
        });
      }
      toast.success(verified ? "Document verified" : "Verification removed");
    } catch { toast.error("Failed to update document"); }
    finally { setVerifyingId(null); }
  };

  const handleDownload = async (filePath: string) => {
    const { data } = await supabase.storage.from("claim-documents").createSignedUrl(filePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Failed to generate download link");
  };

  const showPayoutFields = newStatus === "approved" || newStatus === "paid";
  const calculatedFee = payoutActual ? Math.round(parseFloat(payoutActual) * (FEE_PERCENT / 100) * 100) / 100 : 0;
  const calculatedNet = payoutActual ? Math.round((parseFloat(payoutActual) - calculatedFee) * 100) / 100 : 0;

  return (
    <div>
      <PageHeader title="Claims Management" subtitle="Review and manage filed claims">
        <Button size="sm" variant="outline" className="rounded-xl"><Download className="mr-1 h-3 w-3" />Export CSV</Button>
        <Button size="sm" variant="outline" className="rounded-xl"><Flag className="mr-1 h-3 w-3" />Flag Suspicious</Button>
      </PageHeader>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No claims yet</td></tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{c.user_email}</td>
                  <td className="px-4 py-3 font-medium">{c.settlement_name}</td>
                  <td className="px-4 py-3"><StatusPill variant={c.status as any} /></td>
                  <td className="px-4 py-3 text-primary">${c.est_payout.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{c.filed_at || "—"}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => openClaimDialog(c)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Review Claim — {selectedClaim?.settlement_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Claim Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">User</p>
                <p className="font-medium">{selectedClaim?.user_email}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Estimated Payout</p>
                <p className="font-medium text-primary">${selectedClaim?.est_payout.toLocaleString()}</p>
              </div>
            </div>

            {/* Documents */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Documents ({docs.length})
              </h4>
              {loadingDocs ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : docs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No documents uploaded</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${doc.verified ? "border-success/30 bg-success/5" : "border-border"}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{doc.note || doc.file_path.split("/").pop()}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {doc.file_type && <span className="bg-muted px-1.5 py-0.5 rounded">{doc.file_type}</span>}
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            {doc.verified && <span className="text-success flex items-center gap-0.5"><CheckCircle className="h-3 w-3" /> Verified</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(doc.file_path)} title="Download">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className={`h-7 w-7 p-0 ${doc.verified ? "text-success" : "text-muted-foreground"}`}
                          disabled={verifyingId === doc.id} onClick={() => handleVerifyDoc(doc.id, !doc.verified)} title={doc.verified ? "Remove verification" : "Mark as verified"}>
                          {verifyingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : doc.verified ? <CheckCircle className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Update */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">Update Status</h4>
              <div>
                <Label className="mb-1.5">New Status</Label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ClaimStatusT)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="documentation_required">Documentation Required</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Payout fields for approve/paid */}
              {showPayoutFields && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Payout Processing
                  </div>
                  <div>
                    <Label className="mb-1.5">Actual Payout Amount ($)</Label>
                    <Input type="number" placeholder="0.00" value={payoutActual} onChange={(e) => setPayoutActual(e.target.value)} min="0" step="0.01" />
                  </div>
                  {payoutActual && parseFloat(payoutActual) > 0 && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">Gross</p>
                        <p className="text-sm font-bold text-primary">${parseFloat(payoutActual).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">Fee ({FEE_PERCENT}%)</p>
                        <p className="text-sm font-bold text-warning">${calculatedFee.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-background p-2">
                        <p className="text-[10px] text-muted-foreground">Net to User</p>
                        <p className="text-sm font-bold text-success">${calculatedNet.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="mb-1.5">Note</Label>
                <Textarea placeholder="Add a note for the user (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" rows={2} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedClaim(null)}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={updating}>
              {updating ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClaims;
