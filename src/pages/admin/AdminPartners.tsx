import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, FileText, DollarSign, Search, Building2, Plus, Pencil, Link2, Unlink,
  Trash2, Eye, ArrowLeft, CheckCircle, Clock, XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

/* ───── Types ───── */
interface PartnerRow {
  user_id: string;
  email: string;
  created_at: string;
  firm_id: string | null;
  firm_name: string | null;
  total_claims: number;
  submitted: number;
  under_review: number;
  approved: number;
  rejected: number;
  paid: number;
  total_payout: number;
}

interface FirmRow {
  id: string;
  name: string;
  status: string;
  contact_email: string | null;
  website: string | null;
  created_at: string;
  partner_count: number;
}

const AdminPartners = () => {
  const { user } = useAuth();

  /* ── Partner users state ── */
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Firms state ── */
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(true);
  const [firmSearch, setFirmSearch] = useState("");

  /* ── Firm dialog ── */
  const [firmDialogOpen, setFirmDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<FirmRow | null>(null);
  const [firmForm, setFirmForm] = useState({ name: "", contact_email: "", website: "", status: "active" });

  /* ── Delete confirm ── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFirm, setDeletingFirm] = useState<FirmRow | null>(null);

  /* ── Firm detail view ── */
  const [detailFirm, setDetailFirm] = useState<FirmRow | null>(null);

  /* ── Link dialog ── */
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPartnerId, setLinkPartnerId] = useState<string | null>(null);
  const [linkFirmId, setLinkFirmId] = useState("");

  /* ────────── Fetch Partners ────────── */
  const fetchPartners = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, created_at")
        .eq("role", "partner");

      if (!roles || roles.length === 0) { setPartners([]); setLoading(false); return; }

      const partnerIds = roles.map((r) => r.user_id);

      const [profilesRes, claimsRes, ppRes] = await Promise.all([
        supabase.from("user_profiles").select("user_id, email").in("user_id", partnerIds),
        supabase.from("claims").select("partner_id, status, est_payout, final_payout").in("partner_id", partnerIds),
        supabase.from("partner_profiles").select("user_id, firm_id").in("user_id", partnerIds),
      ]);

      const emailMap: Record<string, string> = {};
      profilesRes.data?.forEach((p) => { emailMap[p.user_id] = p.email || "—"; });

      const firmIdMap: Record<string, string | null> = {};
      ppRes.data?.forEach((pp) => { firmIdMap[pp.user_id] = pp.firm_id; });

      const firmNameMap: Record<string, string> = {};
      firms.forEach((f) => { firmNameMap[f.id] = f.name; });

      const statsMap: Record<string, Omit<PartnerRow, "user_id" | "email" | "created_at" | "firm_id" | "firm_name">> = {};
      partnerIds.forEach((id) => {
        statsMap[id] = { total_claims: 0, submitted: 0, under_review: 0, approved: 0, rejected: 0, paid: 0, total_payout: 0 };
      });

      claimsRes.data?.forEach((c: any) => {
        const pid = c.partner_id;
        if (!pid || !statsMap[pid]) return;
        statsMap[pid].total_claims++;
        if (c.status in statsMap[pid]) { (statsMap[pid] as any)[c.status]++; }
        statsMap[pid].total_payout += Number(c.final_payout || c.est_payout) || 0;
      });

      const rows: PartnerRow[] = roles.map((r) => ({
        user_id: r.user_id,
        email: emailMap[r.user_id] || "—",
        created_at: r.created_at,
        firm_id: firmIdMap[r.user_id] ?? null,
        firm_name: firmIdMap[r.user_id] ? firmNameMap[firmIdMap[r.user_id]!] ?? null : null,
        ...statsMap[r.user_id],
      }));

      setPartners(rows);
    } catch (err) {
      console.error("Error fetching partners:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ────────── Fetch Firms ────────── */
  const fetchFirms = async () => {
    if (!user) return;
    setFirmsLoading(true);
    try {
      const [firmsRes, ppRes] = await Promise.all([
        supabase.from("partner_firms").select("*").order("created_at", { ascending: false }),
        supabase.from("partner_profiles").select("firm_id"),
      ]);

      const countMap: Record<string, number> = {};
      ppRes.data?.forEach((pp) => {
        if (pp.firm_id) countMap[pp.firm_id] = (countMap[pp.firm_id] || 0) + 1;
      });

      const rows: FirmRow[] = (firmsRes.data || []).map((f) => ({
        ...f,
        partner_count: countMap[f.id] || 0,
      }));
      setFirms(rows);
    } catch (err) {
      console.error("Error fetching firms:", err);
    } finally {
      setFirmsLoading(false);
    }
  };

  useEffect(() => { fetchFirms(); }, [user]);
  useEffect(() => { if (!firmsLoading) fetchPartners(); }, [user, firmsLoading]);

  /* ────────── Firm CRUD ────────── */
  const openCreateFirm = () => {
    setEditingFirm(null);
    setFirmForm({ name: "", contact_email: "", website: "", status: "active" });
    setFirmDialogOpen(true);
  };

  const openEditFirm = (firm: FirmRow) => {
    setEditingFirm(firm);
    setFirmForm({ name: firm.name, contact_email: firm.contact_email || "", website: firm.website || "", status: firm.status });
    setFirmDialogOpen(true);
  };

  const saveFirm = async () => {
    if (!firmForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }

    const payload = {
      name: firmForm.name.trim(),
      contact_email: firmForm.contact_email.trim() || null,
      website: firmForm.website.trim() || null,
      status: firmForm.status,
    };

    if (editingFirm) {
      const { error } = await supabase.from("partner_firms").update(payload).eq("id", editingFirm.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Firm updated" });
    } else {
      const { error } = await supabase.from("partner_firms").insert(payload);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Firm created" });
    }

    setFirmDialogOpen(false);
    await fetchFirms();
    fetchPartners();
  };

  /* ────────── Delete Firm ────────── */
  const confirmDeleteFirm = (firm: FirmRow) => {
    setDeletingFirm(firm);
    setDeleteDialogOpen(true);
  };

  const deleteFirm = async () => {
    if (!deletingFirm) return;

    // Unlink all partners from this firm first
    await supabase.from("partner_profiles").update({ firm_id: null }).eq("firm_id", deletingFirm.id);

    // Also clear partner_firm_id on claims
    await supabase.from("claims").update({ partner_firm_id: null }).eq("partner_firm_id", deletingFirm.id);

    const { error } = await supabase.from("partner_firms").delete().eq("id", deletingFirm.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Firm deleted" });
      if (detailFirm?.id === deletingFirm.id) setDetailFirm(null);
    }

    setDeleteDialogOpen(false);
    setDeletingFirm(null);
    await fetchFirms();
    fetchPartners();
  };

  /* ────────── Link / Unlink Partner ────────── */
  const openLinkDialog = (partnerId: string) => {
    setLinkPartnerId(partnerId);
    const existing = partners.find((p) => p.user_id === partnerId);
    setLinkFirmId(existing?.firm_id || "");
    setLinkDialogOpen(true);
  };

  const saveLink = async () => {
    if (!linkPartnerId) return;
    const firmId = linkFirmId || null;

    const { error } = await supabase.from("partner_profiles").upsert(
      { user_id: linkPartnerId, firm_id: firmId },
      { onConflict: "user_id" }
    );

    if (error) { toast({ title: "Link failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: firmId ? "Partner linked to firm" : "Partner unlinked" });
    setLinkDialogOpen(false);
    await fetchFirms();
    fetchPartners();
  };

  const unlinkPartner = async (partnerId: string) => {
    const { error } = await supabase.from("partner_profiles").update({ firm_id: null }).eq("user_id", partnerId);
    if (error) { toast({ title: "Unlink failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Partner unlinked from firm" });
    await fetchFirms();
    fetchPartners();
  };

  /* ────────── Derived data ────────── */
  const filteredPartners = partners.filter((p) => p.email.toLowerCase().includes(search.toLowerCase()));
  const filteredFirms = firms.filter((f) => f.name.toLowerCase().includes(firmSearch.toLowerCase()));

  const totals = partners.reduce(
    (acc, p) => ({ partners: acc.partners + 1, claims: acc.claims + p.total_claims, approved: acc.approved + p.approved + p.paid, payout: acc.payout + p.total_payout }),
    { partners: 0, claims: 0, approved: 0, payout: 0 }
  );

  /* ── Firm detail helpers ── */
  const firmPartners = detailFirm ? partners.filter((p) => p.firm_id === detailFirm.id) : [];
  const firmMetrics = firmPartners.reduce(
    (acc, p) => ({
      total_claims: acc.total_claims + p.total_claims,
      submitted: acc.submitted + p.submitted,
      under_review: acc.under_review + p.under_review,
      approved: acc.approved + p.approved,
      rejected: acc.rejected + p.rejected,
      paid: acc.paid + p.paid,
      total_payout: acc.total_payout + p.total_payout,
    }),
    { total_claims: 0, submitted: 0, under_review: 0, approved: 0, rejected: 0, paid: 0, total_payout: 0 }
  );

  /* ────────── Render: Firm Detail View ────────── */
  if (detailFirm) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" className="gap-2 mb-2" onClick={() => setDetailFirm(null)}>
            <ArrowLeft className="h-4 w-4" /> Back to Partners
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{detailFirm.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${detailFirm.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {detailFirm.status}
                </span>
                {detailFirm.contact_email && <span>{detailFirm.contact_email}</span>}
                {detailFirm.website && (
                  <a href={detailFirm.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{detailFirm.website}</a>
                )}
                <span>Created {new Date(detailFirm.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditFirm(detailFirm)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => confirmDeleteFirm(detailFirm)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Combined Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Users className="h-3.5 w-3.5" /> Partners</div>
            <p className="text-2xl font-bold">{firmPartners.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><FileText className="h-3.5 w-3.5" /> Total Claims</div>
            <p className="text-2xl font-bold">{firmMetrics.total_claims}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Clock className="h-3.5 w-3.5" /> Under Review</div>
            <p className="text-2xl font-bold">{firmMetrics.submitted + firmMetrics.under_review}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><CheckCircle className="h-3.5 w-3.5" /> Approved</div>
            <p className="text-2xl font-bold">{firmMetrics.approved}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><XCircle className="h-3.5 w-3.5" /> Rejected</div>
            <p className="text-2xl font-bold">{firmMetrics.rejected}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><DollarSign className="h-3.5 w-3.5" /> Total Payout</div>
            <p className="text-2xl font-bold text-primary">${firmMetrics.total_payout.toLocaleString()}</p>
          </div>
        </div>

        {/* Linked Partners Table */}
        <h2 className="text-lg font-semibold mb-3">Linked Partners</h2>
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claims</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submitted</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Under Review</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Approved</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rejected</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paid</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {firmPartners.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No partners linked to this firm</td></tr>
              ) : (
                firmPartners.map((p) => (
                  <tr key={p.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.email}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{p.total_claims}</td>
                    <td className="px-4 py-3">{p.submitted}</td>
                    <td className="px-4 py-3">{p.under_review}</td>
                    <td className="px-4 py-3">{p.approved}</td>
                    <td className="px-4 py-3">{p.rejected}</td>
                    <td className="px-4 py-3">{p.paid}</td>
                    <td className="px-4 py-3 text-primary">${p.total_payout.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => unlinkPartner(p.user_id)} className="gap-1 text-destructive hover:text-destructive">
                        <Unlink className="h-3.5 w-3.5" /> Unlink
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dialogs still need to render in detail view */}
        {renderFirmDialog()}
        {renderDeleteDialog()}
      </div>
    );
  }

  /* ────────── Render helpers for dialogs ────────── */
  function renderFirmDialog() {
    return (
      <Dialog open={firmDialogOpen} onOpenChange={setFirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFirm ? "Edit Partner Firm" : "Create Partner Firm"}</DialogTitle>
            <DialogDescription>
              {editingFirm ? "Update the firm's information below." : "Fill in the details to create a new partner firm."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Firm Name *</Label>
              <Input value={firmForm.name} onChange={(e) => setFirmForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Law Group" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input value={firmForm.contact_email} onChange={(e) => setFirmForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="contact@firm.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={firmForm.website} onChange={(e) => setFirmForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://firm.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={firmForm.status} onValueChange={(v) => setFirmForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirmDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveFirm}>{editingFirm ? "Save Changes" : "Create Firm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderDeleteDialog() {
    return (
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner Firm</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deletingFirm?.name}</span>?
              {(deletingFirm?.partner_count ?? 0) > 0 && (
                <span className="block mt-1">This will unlink {deletingFirm?.partner_count} partner(s) from this firm.</span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  /* ────────── Main Render ────────── */
  return (
    <div>
      <PageHeader title="Partner Management" subtitle="Manage partner firms, users, and claim performance" />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Partners" value={totals.partners} variant="teal" />
        <StatCard icon={Building2} label="Partner Firms" value={firms.length} />
        <StatCard icon={FileText} label="Assigned Claims" value={totals.claims} />
        <StatCard icon={DollarSign} label="Total Payout Value" value={`$${totals.payout.toLocaleString()}`} />
      </div>

      <Tabs defaultValue="firms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="firms">Partner Firms</TabsTrigger>
          <TabsTrigger value="users">Partner Users</TabsTrigger>
        </TabsList>

        {/* ═══ Firms Tab ═══ */}
        <TabsContent value="firms" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search firms..." className="pl-9 rounded-xl" value={firmSearch} onChange={(e) => setFirmSearch(e.target.value)} />
            </div>
            <Button onClick={openCreateFirm} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> New Firm
            </Button>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Firm Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Website</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partners</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {firmsLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredFirms.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No firms found</td></tr>
                ) : (
                  filteredFirms.map((f) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <button onClick={() => setDetailFirm(f)} className="text-primary hover:underline font-medium text-left">
                          {f.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${f.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{f.contact_email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.website ? <a href={f.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{f.website}</a> : "—"}</td>
                      <td className="px-4 py-3">{f.partner_count}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailFirm(f)} className="gap-1">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditFirm(f)} className="gap-1">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => confirmDeleteFirm(f)} className="gap-1 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ═══ Users Tab ═══ */}
        <TabsContent value="users" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search partners..." className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partner Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Firm</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claims</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Approved</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredPartners.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No partners found</td></tr>
                ) : (
                  filteredPartners.map((p) => (
                    <tr key={p.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{p.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.firm_name || <span className="italic text-muted-foreground/60">Unlinked</span>}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{p.total_claims}</td>
                      <td className="px-4 py-3">{p.approved + p.paid}</td>
                      <td className="px-4 py-3 text-primary">${p.total_payout.toLocaleString()}</td>
                      <td className="px-4 py-3 flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openLinkDialog(p.user_id)} className="gap-1">
                          <Link2 className="h-3.5 w-3.5" /> {p.firm_id ? "Change" : "Link"}
                        </Button>
                        {p.firm_id && (
                          <Button variant="ghost" size="sm" onClick={() => unlinkPartner(p.user_id)} className="gap-1 text-destructive hover:text-destructive">
                            <Unlink className="h-3.5 w-3.5" /> Unlink
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {renderFirmDialog()}
      {renderDeleteDialog()}

      {/* ═══ Link Partner to Firm Dialog ═══ */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link Partner to Firm</DialogTitle>
            <DialogDescription>Select a firm to assign this partner to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Partner: <span className="font-medium text-foreground">{partners.find((p) => p.user_id === linkPartnerId)?.email}</span>
            </p>
            <div className="space-y-1.5">
              <Label>Select Firm</Label>
              <Select value={linkFirmId} onValueChange={setLinkFirmId}>
                <SelectTrigger><SelectValue placeholder="Choose a firm…" /></SelectTrigger>
                <SelectContent>
                  {firms.filter((f) => f.status === "active").map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLink}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPartners;
