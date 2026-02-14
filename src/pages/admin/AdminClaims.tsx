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
import { Download, Flag, Edit2, FileText, CheckCircle, ExternalLink, Shield, Loader2, DollarSign, Filter, User, Building, Calendar, UserCheck } from "lucide-react";
import { toast } from "sonner";

type ClaimStatusT = "submitted" | "under_review" | "documentation_required" | "approved" | "rejected" | "paid";

const STATUS_OPTIONS: { value: ClaimStatusT | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documentation_required", label: "Docs Required" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

interface ClaimRow {
  id: string;
  settlement_id: string;
  settlement_name: string;
  settlement_company: string;
  settlement_breach_year: number | null;
  status: string;
  est_payout: number;
  filed_at: string | null;
  updated_at: string;
  user_email: string | null;
  user_id: string;
  user_joined: string | null;
  doc_count: number;
  exposed_fields: string[];
  partner_id: string | null;
}

interface PartnerOption {
  user_id: string;
  email: string;
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
  const [statusFilter, setStatusFilter] = useState<ClaimStatusT | "all">("all");

  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null);
  const [newStatus, setNewStatus] = useState<ClaimStatusT>("submitted");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const [payoutActual, setPayoutActual] = useState("");

  const [docs, setDocs] = useState<ClaimDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [assigningPartner, setAssigningPartner] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchClaims();
    fetchPartners();
  }, [user]);

  const fetchPartners = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "partner");
    if (!roles || roles.length === 0) return;
    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("user_profiles").select("user_id, email").in("user_id", ids);
    setPartnerOptions((profiles || []).map((p) => ({ user_id: p.user_id, email: p.email || p.user_id })));
  };

  const fetchClaims = async () => {
    try {
      const { data } = await supabase
        .from("claims")
        .select(`id, status, est_payout, filed_at, updated_at, user_id, settlement_id, partner_id, settlements(name, company, breach_year)`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) {
        const userIds = [...new Set(data.map((c: any) => c.user_id))];

        // Fetch profiles and doc counts in parallel
        const [profilesRes, docsRes, breachesRes] = await Promise.all([
          supabase.from("user_profiles").select("user_id, email, created_at").in("user_id", userIds),
          supabase.from("claim_documents").select("claim_id").in("claim_id", data.map((c: any) => c.id)),
          supabase.from("breach_events").select("user_id, exposed_fields").in("user_id", userIds),
        ]);

        const emailMap: Record<string, { email: string; joined: string }> = {};
        profilesRes.data?.forEach((p: any) => {
          emailMap[p.user_id] = { email: p.email || "", joined: p.created_at };
        });

        const docCountMap: Record<string, number> = {};
        docsRes.data?.forEach((d: any) => {
          docCountMap[d.claim_id] = (docCountMap[d.claim_id] || 0) + 1;
        });

        // Aggregate exposed fields per user
        const exposureMap: Record<string, Set<string>> = {};
        breachesRes.data?.forEach((b: any) => {
          if (!exposureMap[b.user_id]) exposureMap[b.user_id] = new Set();
          (b.exposed_fields || []).forEach((f: string) => exposureMap[b.user_id].add(f));
        });

        setClaims(data.map((c: any) => ({
          id: c.id,
          settlement_id: c.settlement_id,
          settlement_name: c.settlements?.name || "Unknown",
          settlement_company: c.settlements?.company || "Unknown",
          settlement_breach_year: c.settlements?.breach_year || null,
          status: c.status,
          est_payout: Number(c.est_payout) || 0,
          filed_at: c.filed_at,
          updated_at: c.updated_at,
          user_email: emailMap[c.user_id]?.email || "—",
          user_id: c.user_id,
          user_joined: emailMap[c.user_id]?.joined || null,
          doc_count: docCountMap[c.id] || 0,
          exposed_fields: exposureMap[c.user_id] ? Array.from(exposureMap[c.user_id]) : [],
          partner_id: c.partner_id || null,
        })));
      }
    } catch (error) {
      console.error("Error fetching admin claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClaims = statusFilter === "all" ? claims : claims.filter(c => c.status === statusFilter);

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
      // If marking as paid, use the simulate-payout edge function
      if (newStatus === "paid") {
        // First update payout amounts if provided
        if (payoutActual) {
          const actual = parseFloat(payoutActual);
          if (!isNaN(actual) && actual > 0) {
            const fee = Math.round(actual * (FEE_PERCENT / 100) * 100) / 100;
            const net = Math.round((actual - fee) * 100) / 100;
            await supabase.from("claims").update({
              final_payout: actual,
              platform_fee: fee,
              net_payout: net,
              updated_at: new Date().toISOString(),
            }).eq("id", selectedClaim.id);
          }
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`${supabaseUrl}/functions/v1/simulate-payout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({ claim_id: selectedClaim.id }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Payout failed");

        toast.success(`Payout processed — Ref: ${result.stripe_ref}`);
        setClaims(claims.map(c =>
          c.id === selectedClaim.id ? { ...c, status: "paid", updated_at: new Date().toISOString() } : c
        ));
        setSelectedClaim(null);
        return;
      }

      // For all other statuses, use inline update
      const updatePayload: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "rejected" && note) {
        updatePayload.flag_reason = note;
      }

      if (newStatus === "approved" && payoutActual) {
        const actual = parseFloat(payoutActual);
        if (!isNaN(actual) && actual > 0) {
          const fee = Math.round(actual * (FEE_PERCENT / 100) * 100) / 100;
          const net = Math.round((actual - fee) * 100) / 100;
          updatePayload.final_payout = actual;
          updatePayload.platform_fee = fee;
          updatePayload.net_payout = net;
        }
      }

      const { error: updateError } = await supabase
        .from("claims")
        .update(updatePayload)
        .eq("id", selectedClaim.id);
      if (updateError) throw updateError;

      // Insert claim_status_history
      await supabase.from("claim_status_history").insert({
        claim_id: selectedClaim.id,
        status: newStatus,
        note: note || (payoutActual ? `Payout: $${payoutActual} (Fee: ${FEE_PERCENT}%)` : null),
        updated_by: user?.email || "admin",
      });

      // Trigger user alert
      const alertTitle = newStatus === "approved"
        ? "Your claim has been approved!"
        : newStatus === "rejected"
        ? "Your claim has been rejected"
        : `Claim status updated to ${newStatus.replace("_", " ")}`;

      const alertBody = newStatus === "rejected" && note
        ? `Reason: ${note}`
        : newStatus === "approved" && payoutActual
        ? `Estimated payout: $${parseFloat(payoutActual).toLocaleString()} for the ${selectedClaim.settlement_name} settlement.`
        : `Your claim for ${selectedClaim.settlement_name} has been updated.`;

      const alertSeverity = newStatus === "rejected" ? "high" : "medium";

      await supabase.from("alerts").insert({
        user_id: selectedClaim.user_id,
        type: "claim_update" as const,
        title: alertTitle,
        body: alertBody,
        severity: alertSeverity as any,
        related_claim_id: selectedClaim.id,
      });

      // Admin activity log
      await supabase.from("admin_activity_logs").insert({
        admin_user_id: user?.id,
        action: `claim_${newStatus}`,
        entity_type: "claim",
        entity_id: selectedClaim.id,
        meta: { note, payout: payoutActual || null },
      });

      toast.success("Claim status updated & user notified");
      setClaims(claims.map(c =>
        c.id === selectedClaim.id ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c
      ));
      setSelectedClaim(null);
    } catch (error) {
      console.error("Error updating claim:", error);
      toast.error(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {STATUS_OPTIONS.map((opt) => {
          const count = opt.value === "all" ? claims.length : claims.filter(c => c.status === opt.value).length;
          return (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? "default" : "outline"}
              className="rounded-full text-xs"
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label} ({count})
            </Button>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partner</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Docs</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : filteredClaims.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No claims found</td></tr>
            ) : (
              filteredClaims.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openClaimDialog(c)}>
                  <td className="px-4 py-3 text-xs">{c.user_email}</td>
                  <td className="px-4 py-3 font-medium">{c.settlement_name}</td>
                  <td className="px-4 py-3"><StatusPill variant={c.status as any} /></td>
                  <td className="px-4 py-3 text-primary">${c.est_payout.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{c.partner_id ? (partnerOptions.find(p => p.user_id === c.partner_id)?.email || "Assigned") : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-xs">{c.filed_at || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${c.doc_count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      <FileText className="h-3 w-3" /> {c.doc_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="rounded-lg" onClick={(e) => { e.stopPropagation(); openClaimDialog(c); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Claim Detail Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Review Claim — {selectedClaim?.settlement_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* User Info */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" /> User Info
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                  <p className="font-medium truncate">{selectedClaim?.user_email}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Joined</p>
                  <p className="font-medium">{selectedClaim?.user_joined ? new Date(selectedClaim.user_joined).toLocaleDateString() : "—"}</p>
                </div>
              </div>
            </div>

            {/* Settlement Info */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Building className="h-4 w-4" /> Settlement Info
              </h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Company</p>
                  <p className="font-medium">{selectedClaim?.settlement_company}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Breach Year</p>
                  <p className="font-medium">{selectedClaim?.settlement_breach_year || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Payout</p>
                  <p className="font-medium text-primary">${selectedClaim?.est_payout.toLocaleString()}</p>
                </div>
              </div>
              {selectedClaim && selectedClaim.exposed_fields.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Exposure Types</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedClaim.exposed_fields.map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Partner Assignment */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" /> Assign Partner
              </h4>
              <div className="flex items-center gap-2">
                <select
                  value={selectedClaim?.partner_id || ""}
                  onChange={async (e) => {
                    const partnerId = e.target.value || null;
                    setAssigningPartner(true);
                    try {
                      const { error } = await supabase
                        .from("claims")
                        .update({ partner_id: partnerId, updated_at: new Date().toISOString() })
                        .eq("id", selectedClaim!.id);
                      if (error) throw error;

                      await supabase.from("admin_activity_logs").insert({
                        admin_user_id: user?.id,
                        action: partnerId ? "assign_partner" : "unassign_partner",
                        entity_type: "claim",
                        entity_id: selectedClaim!.id,
                        meta: { partner_id: partnerId },
                      });

                      setClaims((prev) =>
                        prev.map((c) => c.id === selectedClaim!.id ? { ...c, partner_id: partnerId } : c)
                      );
                      setSelectedClaim((prev) => prev ? { ...prev, partner_id: partnerId } : prev);
                      toast.success(partnerId ? "Partner assigned" : "Partner removed");
                    } catch (err) {
                      toast.error("Failed to assign partner");
                    } finally {
                      setAssigningPartner(false);
                    }
                  }}
                  disabled={assigningPartner}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— No partner —</option>
                  {partnerOptions.map((p) => (
                    <option key={p.user_id} value={p.user_id}>{p.email}</option>
                  ))}
                </select>
                {assigningPartner && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

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
                <Label className="mb-1.5">{newStatus === "rejected" ? "Rejection Reason" : "Note"}</Label>
                <Textarea
                  placeholder={newStatus === "rejected" ? "Enter rejection reason (required)" : "Add a note for the user (optional)"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedClaim(null)}>Cancel</Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={updating || (newStatus === "rejected" && !note)}
              variant={newStatus === "rejected" ? "destructive" : "default"}
            >
              {updating ? "Updating..." : newStatus === "rejected" ? "Reject Claim" : newStatus === "approved" ? "Approve Claim" : newStatus === "paid" ? "Mark as Paid" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClaims;
