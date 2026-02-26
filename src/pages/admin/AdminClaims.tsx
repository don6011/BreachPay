import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Flag, Edit2, FileText, CheckCircle, ExternalLink, Shield, Loader2, DollarSign, Filter, User, Building, Calendar, UserCheck, Link2, XCircle } from "lucide-react";
import { toast } from "sonner";

type ClaimStatusT = "draft" | "submitted" | "under_review" | "documentation_required" | "approved" | "rejected" | "paid";

const STATUS_OPTIONS: { value: ClaimStatusT | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documentation_required", label: "Docs Required" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

interface BreachEvidence {
  source: string;
  breach_year: number | null;
  risk_level: string;
  exposed_fields: string[];
  catalog_verified: boolean;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
}

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
  partner_firm_id: string | null;
}

interface FirmOption {
  id: string;
  name: string;
}

interface PartnerOption {
  user_id: string;
  email: string;
}

interface PartnerOrgOption {
  id: string;
  name: string;
  partner_type: string;
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
  const [payoutMethod, setPayoutMethod] = useState("unknown");
  const [payoutRef, setPayoutRef] = useState("");
  const [initiatingPayout, setInitiatingPayout] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);

  const [docs, setDocs] = useState<ClaimDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [claimPackets, setClaimPackets] = useState<{ id: string; generated_at: string; pdf_file_name: string | null; status: string }[]>([]);
  const [claimShareLinks, setClaimShareLinks] = useState<{ id: string; scope: string; expires_at: string; revoked_at: string | null; access_count: number; created_at: string; last_accessed_at: string | null }[]>([]);
  const [revokingLinkId, setRevokingLinkId] = useState<string | null>(null);

  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [firmOptions, setFirmOptions] = useState<FirmOption[]>([]);
  const [partnerOrgOptions, setPartnerOrgOptions] = useState<PartnerOrgOption[]>([]);
  const [assigningPartner, setAssigningPartner] = useState(false);
  const [claimPartnerOrgId, setClaimPartnerOrgId] = useState<string | null>(null);
  const [breachEvidence, setBreachEvidence] = useState<BreachEvidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [claimApplication, setClaimApplication] = useState<any>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [partnerNotes, setPartnerNotes] = useState<{ id: string; note: string; visibility: string; created_at: string }[]>([]);
  const [partnerDocRequests, setPartnerDocRequests] = useState<{ id: string; request_type: string; message: string | null; status: string; created_at: string; fulfilled_at: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchClaims();
    fetchPartners();
    fetchFirms();
    fetchPartnerOrgs();
  }, [user]);

  const fetchPartnerOrgs = async () => {
    const { data } = await supabase.from("partners").select("id, name, partner_type").eq("is_active", true).order("name");
    setPartnerOrgOptions(data || []);
  };

  const fetchPartners = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "partner");
    if (!roles || roles.length === 0) return;
    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("user_profiles").select("user_id, email").in("user_id", ids);
    setPartnerOptions((profiles || []).map((p) => ({ user_id: p.user_id, email: p.email || p.user_id })));
  };

  const fetchFirms = async () => {
    const { data } = await supabase.from("partner_firms").select("id, name").eq("status", "active").order("name");
    setFirmOptions(data || []);
  };

  const fetchClaims = async () => {
    try {
      const { data } = await supabase
        .from("claims")
        .select(`id, status, est_payout, filed_at, updated_at, user_id, settlement_id, partner_id, partner_firm_id, settlements(name, company, breach_year)`)
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
          partner_firm_id: c.partner_firm_id || null,
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
    setPayoutMethod("unknown");
    setPayoutRef("");
    setLoadingDocs(true);
    setLoadingEvidence(true);
    setLoadingApplication(true);
    setBreachEvidence([]);
    setClaimApplication(null);
    setClaimPartnerOrgId(null);

    const [docsRes, evidenceRes, appRes, assignmentRes, pNotesRes, pDocReqRes, packetsRes, shareLinksRes] = await Promise.all([
      supabase
        .from("claim_documents")
        .select("id, file_path, file_type, note, created_at, verified")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("breach_events")
        .select("source, breach_year, risk_level, exposed_fields, breach_catalog(verified, source_type, source_name, source_url)")
        .eq("user_id", claim.user_id)
        .limit(10),
      supabase
        .from("claim_applications")
        .select("*")
        .eq("claim_id", claim.id)
        .maybeSingle(),
      supabase
        .from("claim_assignments")
        .select("partner_id")
        .eq("claim_id", claim.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("claim_partner_notes")
        .select("id, note, visibility, created_at")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("claim_doc_requests")
        .select("id, request_type, message, status, created_at, fulfilled_at")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("claim_packets")
        .select("id, generated_at, pdf_file_name, status")
        .eq("claim_id", claim.id)
        .order("generated_at", { ascending: false })
        .limit(10),
      supabase
        .from("claim_share_links")
        .select("id, scope, expires_at, revoked_at, access_count, created_at, last_accessed_at")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setDocs((docsRes.data as ClaimDoc[]) || []);
    setLoadingDocs(false);

    if (evidenceRes.data) {
      setBreachEvidence(evidenceRes.data.map((b: any) => ({
        source: b.source,
        breach_year: b.breach_year,
        risk_level: b.risk_level,
        exposed_fields: b.exposed_fields || [],
        catalog_verified: b.breach_catalog?.verified || false,
        source_type: b.breach_catalog?.source_type || null,
        source_name: b.breach_catalog?.source_name || null,
        source_url: b.breach_catalog?.source_url || null,
      })));
    }
    setLoadingEvidence(false);
    setClaimApplication(appRes.data || null);
    setLoadingApplication(false);
    setClaimPartnerOrgId(assignmentRes.data?.partner_id || null);
    setPartnerNotes((pNotesRes.data as any[]) || []);
    setPartnerDocRequests((pDocReqRes.data as any[]) || []);
    setClaimPackets((packetsRes.data as any[]) || []);
    setClaimShareLinks((shareLinksRes.data as any[]) || []);
  };

  const handleStatusUpdate = async () => {
    if (!selectedClaim || !newStatus) return;
    setUpdating(true);
    try {
      // If marking as paid, use the rpc_admin_mark_claim_paid RPC
      if (newStatus === "paid") {
        const actual = parseFloat(payoutActual);
        if (isNaN(actual) || actual <= 0) {
          toast.error("Enter a valid payout amount");
          setUpdating(false);
          return;
        }

        const { error: rpcError } = await supabase.rpc("rpc_admin_mark_claim_paid", {
          p_claim_id: selectedClaim.id,
          p_amount: actual,
          p_method: payoutMethod || "unknown",
          p_external_ref: payoutRef || null,
        });

        if (rpcError) throw rpcError;

        // Also log in claim_status_history
        await supabase.from("claim_status_history").insert({
          claim_id: selectedClaim.id,
          status: "paid",
          note: `Paid $${actual.toLocaleString()} via ${payoutMethod}${payoutRef ? ` (Ref: ${payoutRef})` : ""}`,
          updated_by: user?.email || "admin",
        });

        await supabase.from("admin_activity_logs").insert({
          admin_user_id: user?.id,
          action: "claim_paid",
          entity_type: "claim",
          entity_id: selectedClaim.id,
          meta: { amount: actual, method: payoutMethod, external_ref: payoutRef || null },
        });

        toast.success(`Claim marked paid — $${actual.toLocaleString()} via ${payoutMethod}`);
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

            {/* Claim Application Answers */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Application Answers
              </h4>
              {loadingApplication ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : !claimApplication ? (
                <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No application data (legacy claim)</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Name</p>
                      <p className="font-medium">{claimApplication.full_name || "—"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Email</p>
                      <p className="font-medium truncate">{claimApplication.email || "—"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Phone</p>
                      <p className="font-medium">{claimApplication.phone || "—"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Address</p>
                      <p className="font-medium">{claimApplication.address || "—"}</p>
                    </div>
                  </div>
                  {claimApplication.eligibility_answers && Object.keys(claimApplication.eligibility_answers).length > 0 && (
                    <div className="rounded-lg border p-3 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Eligibility Responses</p>
                      {Object.entries(claimApplication.eligibility_answers).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</span>
                          <span className="font-medium">{typeof value === "boolean" ? (value ? "✅ Yes" : "❌ No") : String(value) || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {claimApplication.breach_experience && (
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Experience Description</p>
                      <p className="text-sm">{claimApplication.breach_experience}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Certifications: {claimApplication.certifications_signed ? "✅ Signed" : "❌ Not signed"}</span>
                    {claimApplication.submitted_at && <span>Submitted: {new Date(claimApplication.submitted_at).toLocaleString()}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Breach Evidence Summary */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> Breach Evidence
              </h4>
              {loadingEvidence ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : breachEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No breach evidence found</p>
              ) : (
                <div className="space-y-2">
                  {breachEvidence.map((ev, idx) => (
                    <div key={idx} className="rounded-lg border p-3 text-sm space-y-1.5">
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
                          ev.risk_level === "critical" ? "bg-destructive/10 text-destructive" :
                          ev.risk_level === "high" ? "bg-destructive/10 text-destructive" :
                          ev.risk_level === "medium" ? "bg-warning/10 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>{ev.risk_level}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ev.exposed_fields.map(f => (
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">{f}</span>
                        ))}
                      </div>
                      {(ev.source_type || ev.source_name) && (
                        <p className="text-[10px] text-muted-foreground">
                          Source: {ev.source_type}{ev.source_name ? `: ${ev.source_name}` : ""}
                          {ev.source_url && (
                            <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline inline-flex items-center gap-0.5">
                              View <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Partner Organization Assignment */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" /> Assign Partner Organization
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Partner Org</label>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={claimPartnerOrgId || ""}
                      onChange={async (e) => {
                        const orgId = e.target.value || null;
                        setAssigningPartner(true);
                        try {
                          if (orgId) {
                            // Upsert claim_assignments
                            const { error } = await supabase.from("claim_assignments").upsert(
                              { claim_id: selectedClaim!.id, partner_id: orgId, assignment_status: "assigned" },
                              { onConflict: "claim_id,partner_id" }
                            );
                            if (error) throw error;
                            // Create referral with deterministic amount_expected at assignment time
                            await supabase.from("referrals").upsert(
                              { claim_id: selectedClaim!.id, partner_id: orgId, model: "cpa", amount_expected: 5, status: "pending" },
                              { onConflict: "claim_id,partner_id" }
                            );
                          } else if (claimPartnerOrgId) {
                            // Remove assignment
                            await supabase.from("claim_assignments").delete().eq("claim_id", selectedClaim!.id).eq("partner_id", claimPartnerOrgId);
                          }
                          await supabase.from("claim_status_history").insert({
                            claim_id: selectedClaim!.id, status: selectedClaim!.status,
                            note: orgId ? `Assigned to partner org` : "Partner org removed",
                            updated_by: user?.email || "admin",
                          });
                          await supabase.from("admin_activity_logs").insert({
                            admin_user_id: user?.id,
                            action: orgId ? "assign_partner_org" : "unassign_partner_org",
                            entity_type: "claim", entity_id: selectedClaim!.id,
                            meta: { partner_org_id: orgId },
                          });
                          setClaimPartnerOrgId(orgId);
                          toast.success(orgId ? "Partner org assigned" : "Partner org removed");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to assign partner org");
                        } finally {
                          setAssigningPartner(false);
                        }
                      }}
                      disabled={assigningPartner}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— No partner org —</option>
                      {partnerOrgOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.name} ({o.partner_type.replace("_", " ")})</option>
                      ))}
                    </select>
                    {assigningPartner && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                {/* Legacy: Partner Firm */}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Legacy Partner Firm</label>
                  <select
                    value={selectedClaim?.partner_firm_id || ""}
                    onChange={async (e) => {
                      const firmId = e.target.value || null;
                      setAssigningPartner(true);
                      try {
                        await supabase.from("claims").update({ partner_firm_id: firmId, updated_at: new Date().toISOString() }).eq("id", selectedClaim!.id);
                        setClaims((prev) => prev.map((c) => c.id === selectedClaim!.id ? { ...c, partner_firm_id: firmId } : c));
                        setSelectedClaim((prev) => prev ? { ...prev, partner_firm_id: firmId } : prev);
                        toast.success(firmId ? "Firm assigned" : "Firm removed");
                      } catch { toast.error("Failed to assign firm"); }
                      finally { setAssigningPartner(false); }
                    }}
                    disabled={assigningPartner}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                  >
                    <option value="">— No firm —</option>
                    {firmOptions.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Partner Notes */}
            {partnerNotes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Partner Notes ({partnerNotes.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {partnerNotes.map((n) => (
                    <div key={n.id} className="rounded-lg border p-2.5 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${n.visibility === "user_visible" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {n.visibility === "user_visible" ? "User visible" : "Internal"}
                        </span>
                      </div>
                      <p className="text-xs">{n.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partner Doc Requests */}
            {partnerDocRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Document Requests ({partnerDocRequests.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {partnerDocRequests.map((dr) => (
                    <div key={dr.id} className={`rounded-lg border p-2.5 text-sm ${dr.status === "fulfilled" ? "border-success/30 bg-success/5" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium capitalize text-xs">{dr.request_type.replace(/_/g, " ")}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          dr.status === "fulfilled" ? "bg-success/10 text-success" :
                          dr.status === "cancelled" ? "bg-muted text-muted-foreground" :
                          "bg-warning/10 text-warning"
                        }`}>{dr.status}</span>
                      </div>
                      {dr.message && <p className="text-xs text-muted-foreground">{dr.message}</p>}
                      <span className="text-[10px] text-muted-foreground">{new Date(dr.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Claim Packets */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Claim Packets ({claimPackets.length})
              </h4>
              {claimPackets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No packets generated</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {claimPackets.map((p) => (
                    <div key={p.id} className={`rounded-lg border p-2.5 text-sm flex items-center justify-between ${p.status === "generated" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                      <div>
                        <p className="text-xs font-medium">{p.pdf_file_name || "Unnamed"}</p>
                        <span className="text-[10px] text-muted-foreground">{new Date(p.generated_at).toLocaleString()}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.status === "generated" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Share Links */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Link2 className="h-4 w-4" /> Share Links ({claimShareLinks.length})
              </h4>
              {claimShareLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No share links created</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {claimShareLinks.map((link) => {
                    const isExpired = new Date(link.expires_at) < new Date();
                    const isRevoked = !!link.revoked_at;
                    const isActive = !isExpired && !isRevoked;
                    return (
                      <div key={link.id} className={`rounded-lg border p-2.5 text-sm ${isActive ? "border-primary/20" : "border-border opacity-60"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium capitalize">{link.scope.replace(/_/g, " ")}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              isRevoked ? "bg-destructive/10 text-destructive" :
                              isExpired ? "bg-muted text-muted-foreground" :
                              "bg-primary/10 text-primary"
                            }`}>
                              {isRevoked ? "Revoked" : isExpired ? "Expired" : "Active"}
                            </span>
                          </div>
                          {isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
                              disabled={revokingLinkId === link.id}
                              onClick={async () => {
                                setRevokingLinkId(link.id);
                                try {
                                  const { error } = await supabase
                                    .from("claim_share_links")
                                    .update({ revoked_at: new Date().toISOString() })
                                    .eq("id", link.id);
                                  if (error) throw error;
                                  setClaimShareLinks(prev => prev.map(l => l.id === link.id ? { ...l, revoked_at: new Date().toISOString() } : l));
                                  toast.success("Share link revoked");
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to revoke");
                                } finally {
                                  setRevokingLinkId(null);
                                }
                              }}
                            >
                              {revokingLinkId === link.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-3 w-3 mr-0.5" /> Revoke</>}
                            </Button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground space-x-3">
                          <span>Expires: {new Date(link.expires_at).toLocaleString()}</span>
                          <span>Views: {link.access_count}</span>
                          {link.last_accessed_at && <span>Last: {new Date(link.last_accessed_at).toLocaleString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mark Paid section removed — now handled via status dropdown + RPC */}


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
                    <Label className="mb-1.5">Payout Amount ($)</Label>
                    <Input type="number" placeholder="0.00" value={payoutActual} onChange={(e) => setPayoutActual(e.target.value)} min="0" step="0.01" />
                  </div>
                  {newStatus === "paid" && (
                    <>
                      <div>
                        <Label className="mb-1.5">Payment Method</Label>
                        <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                          <option value="unknown">Unknown</option>
                          <option value="check">Check</option>
                          <option value="ach">ACH</option>
                          <option value="paypal">PayPal</option>
                          <option value="gift_card">Gift Card</option>
                        </select>
                      </div>
                      <div>
                        <Label className="mb-1.5">External Reference (optional)</Label>
                        <Input placeholder="Check #, transaction ID, etc." value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} />
                      </div>
                    </>
                  )}
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
              onClick={() => {
                if (newStatus === "paid") {
                  const actual = parseFloat(payoutActual);
                  if (isNaN(actual) || actual <= 0) {
                    toast.error("Enter a valid payout amount");
                    return;
                  }
                  setShowPayConfirm(true);
                } else {
                  handleStatusUpdate();
                }
              }}
              disabled={updating || (newStatus === "rejected" && !note)}
              variant={newStatus === "rejected" ? "destructive" : "default"}
            >
              {updating ? "Updating..." : newStatus === "rejected" ? "Reject Claim" : newStatus === "approved" ? "Approve Claim" : newStatus === "paid" ? "Mark as Paid" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Confirmation Dialog */}
      <AlertDialog open={showPayConfirm} onOpenChange={setShowPayConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <DollarSign className="h-5 w-5" /> Confirm Payout
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to mark this claim as <strong>paid</strong>. This action will:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Record a <strong>${payoutActual ? parseFloat(payoutActual).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</strong> payout via <strong>{payoutMethod}</strong></li>
                  <li>Notify the user by email and in-app</li>
                  <li>Move associated referrals to invoiced status</li>
                </ul>
                {payoutRef && <p className="text-xs">External ref: <code className="bg-muted px-1 rounded">{payoutRef}</code></p>}
                <p className="font-semibold text-destructive text-sm">This cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowPayConfirm(false);
                handleStatusUpdate();
              }}
            >
              Confirm Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminClaims;
