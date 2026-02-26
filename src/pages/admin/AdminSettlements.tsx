import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Send, Zap, RefreshCw, Pencil, ExternalLink, Check, X,
  Database, FileSearch, Shield, AlertTriangle, Eye, Globe,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────
interface Settlement {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  status: string;
  payout_min: number | null;
  payout_max: number | null;
  deadline: string | null;
  description: string | null;
  verified: boolean;
  verification_level: string;
  jurisdiction: string | null;
  case_number: string | null;
  administrator_name: string | null;
  official_source_url: string | null;
  claims_filing_url: string | null;
  claim_deadline: string | null;
  notes_internal: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
  verification_notes: string | null;
  last_verified_at: string | null;
  category: string | null;
  eligibility_summary: string | null;
  claim_url: string | null;
  canonical_key: string;
}

interface QueueItem {
  id: string;
  settlement_id: string;
  priority: number;
  reason: string;
  status: string;
  notes: string | null;
  created_at: string;
  settlement?: Settlement;
}

interface Source {
  id: string;
  name: string;
  type: string;
  base_url: string | null;
  reliability_score: number;
  is_active: boolean;
  fetch_strategy: string;
  created_at: string;
}

interface RawIngest {
  id: string;
  source_id: string | null;
  source_record_id: string | null;
  raw_url: string | null;
  raw_payload: Record<string, unknown>;
  content_hash: string;
  fetched_at: string;
  source?: Source;
}

const VERIFICATION_LEVELS = [
  { value: "unverified", label: "Unverified" },
  { value: "source_linked", label: "Source Linked" },
  { value: "court_verified", label: "Court Verified" },
  { value: "administrator_confirmed", label: "Administrator Confirmed" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending Review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "open", label: "Open (legacy)" },
];

const emptyForm = () => ({
  name: "", company: "", breach_year: "", status: "pending_review",
  payout_min: "", payout_max: "", deadline: "", description: "",
  verified: false, verification_level: "unverified",
  jurisdiction: "", case_number: "", administrator_name: "",
  official_source_url: "", claims_filing_url: "",
  claim_deadline: "", notes_internal: "",
  source_type: "", source_name: "", source_url: "",
  verification_notes: "", eligibility_summary: "", claim_url: "", category: "data_breach",
});

// ── Component ──────────────────────────────────────────
const AdminSettlements = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("queue");

  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  // Verified state
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(true);

  // Sources state
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  // Raw Ingest state
  const [rawIngest, setRawIngest] = useState<RawIngest[]>([]);
  const [rawLoading, setRawLoading] = useState(true);
  const [expandedRaw, setExpandedRaw] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Source dialog state
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState({ name: "", type: "manual", base_url: "", reliability_score: "70", is_active: true, fetch_strategy: "manual" });

  // Actions
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [rebuildingMatches, setRebuildingMatches] = useState(false);
  const [runningScan, setRunningScan] = useState(false);

  // ── Fetchers ──────────────────────────────────────────
  const fetchQueue = async () => {
    setQueueLoading(true);
    const { data } = await supabase
      .from("settlement_verification_queue")
      .select("*")
      .eq("status", "open")
      .order("priority", { ascending: false });

    if (data && data.length > 0) {
      const sIds = data.map((q: any) => q.settlement_id);
      const { data: sData } = await supabase.from("settlements").select("*").in("id", sIds);
      const sMap: Record<string, Settlement> = {};
      (sData || []).forEach((s: any) => { sMap[s.id] = s; });
      setQueueItems(data.map((q: any) => ({ ...q, settlement: sMap[q.settlement_id] })));
    } else {
      setQueueItems([]);
    }
    setQueueLoading(false);
  };

  const fetchSettlements = async () => {
    setSettlementsLoading(true);
    const { data } = await supabase
      .from("settlements")
      .select("*")
      .in("status", ["verified", "open"])
      .order("created_at", { ascending: false });
    if (data) setSettlements(data as Settlement[]);
    setSettlementsLoading(false);
  };

  const fetchSources = async () => {
    setSourcesLoading(true);
    const { data } = await supabase.from("settlement_sources").select("*").order("created_at", { ascending: false });
    if (data) setSources(data as Source[]);
    setSourcesLoading(false);
  };

  const fetchRawIngest = async () => {
    setRawLoading(true);
    const { data } = await supabase.from("settlement_raw_ingest").select("*").order("fetched_at", { ascending: false }).limit(100);
    if (data) {
      // Fetch source names
      const srcIds = [...new Set(data.filter((r: any) => r.source_id).map((r: any) => r.source_id))];
      let srcMap: Record<string, Source> = {};
      if (srcIds.length > 0) {
        const { data: srcData } = await supabase.from("settlement_sources").select("*").in("id", srcIds);
        (srcData || []).forEach((s: any) => { srcMap[s.id] = s; });
      }
      setRawIngest(data.map((r: any) => ({ ...r, source: r.source_id ? srcMap[r.source_id] : undefined })));
    }
    setRawLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchQueue();
    fetchSettlements();
    fetchSources();
    fetchRawIngest();
  }, [user]);

  // ── Queue Actions ──────────────────────────────────────
  const handleApprove = async (item: QueueItem) => {
    try {
      await supabase.from("settlements").update({
        status: "verified",
        verified: true,
        verification_level: "source_linked",
        last_verified_at: new Date().toISOString(),
      }).eq("id", item.settlement_id);

      await supabase.from("settlement_verification_queue").update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", item.id);

      toast({ title: "Settlement approved and verified" });
      fetchQueue();
      fetchSettlements();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (item: QueueItem) => {
    try {
      await supabase.from("settlements").update({ status: "rejected" }).eq("id", item.settlement_id);
      await supabase.from("settlement_verification_queue").update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", item.id);

      toast({ title: "Settlement rejected" });
      fetchQueue();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Settlement CRUD ────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setValidationErrors([]);
    setDialogOpen(true);
  };

  const openEdit = (s: Settlement) => {
    setEditingId(s.id);
    setForm({
      name: s.name, company: s.company,
      breach_year: s.breach_year?.toString() || "",
      status: s.status,
      payout_min: s.payout_min?.toString() || "",
      payout_max: s.payout_max?.toString() || "",
      deadline: s.deadline || "",
      description: s.description || "",
      verified: s.verified,
      verification_level: s.verification_level,
      jurisdiction: s.jurisdiction || "",
      case_number: s.case_number || "",
      administrator_name: s.administrator_name || "",
      official_source_url: s.official_source_url || "",
      claims_filing_url: s.claims_filing_url || "",
      claim_deadline: s.claim_deadline || "",
      notes_internal: s.notes_internal || "",
      source_type: s.source_type || "",
      source_name: s.source_name || "",
      source_url: s.source_url || "",
      verification_notes: s.verification_notes || "",
      eligibility_summary: s.eligibility_summary || "",
      claim_url: s.claim_url || "",
      category: s.category || "data_breach",
    });
    setValidationErrors([]);
    setDialogOpen(true);
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push("Name is required.");
    if (!form.company.trim()) errors.push("Company is required.");
    if (form.verified && !form.official_source_url.trim() && !form.claims_filing_url.trim()) {
      errors.push("Verified settlements require an Official Source URL or Claims Filing URL.");
    }
    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (errors.length) { setValidationErrors(errors); return; }
    setValidationErrors([]);
    setSaving(true);

    const payload: any = {
      name: form.name.trim(),
      company: form.company.trim(),
      breach_year: form.breach_year ? parseInt(form.breach_year) : null,
      status: form.status,
      payout_min: form.payout_min ? parseFloat(form.payout_min) : null,
      payout_max: form.payout_max ? parseFloat(form.payout_max) : null,
      deadline: form.deadline || null,
      description: form.description.trim() || null,
      verified: form.verified,
      verification_level: form.verification_level,
      jurisdiction: form.jurisdiction.trim() || null,
      case_number: form.case_number.trim() || null,
      administrator_name: form.administrator_name.trim() || null,
      official_source_url: form.official_source_url.trim() || null,
      claims_filing_url: form.claims_filing_url.trim() || null,
      claim_deadline: form.claim_deadline || null,
      notes_internal: form.notes_internal.trim() || null,
      source_type: form.source_type.trim() || null,
      source_name: form.source_name.trim() || null,
      source_url: form.source_url.trim() || null,
      verification_notes: form.verification_notes.trim() || null,
      eligibility_summary: form.eligibility_summary.trim() || null,
      claim_url: form.claim_url.trim() || null,
      category: form.category || "data_breach",
    };

    if (form.verified) payload.last_verified_at = new Date().toISOString();

    try {
      if (editingId) {
        const { error } = await supabase.from("settlements").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Settlement updated" });
      } else {
        payload.created_by = user?.id;
        payload.canonical_key = (form.company + ":" + form.name + ":" + (form.claim_deadline || "")).toLowerCase().replace(/[^a-z0-9:]/g, "");
        const { error } = await supabase.from("settlements").insert(payload);
        if (error) throw error;
        toast({ title: "Settlement created" });
      }
      setDialogOpen(false);
      fetchSettlements();
      fetchQueue();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Source CRUD ─────────────────────────────────────────
  const openCreateSource = () => {
    setEditingSourceId(null);
    setSourceForm({ name: "", type: "manual", base_url: "", reliability_score: "70", is_active: true, fetch_strategy: "manual" });
    setSourceDialogOpen(true);
  };

  const openEditSource = (s: Source) => {
    setEditingSourceId(s.id);
    setSourceForm({ name: s.name, type: s.type, base_url: s.base_url || "", reliability_score: s.reliability_score.toString(), is_active: s.is_active, fetch_strategy: s.fetch_strategy });
    setSourceDialogOpen(true);
  };

  const handleSaveSource = async () => {
    if (!sourceForm.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload = {
      name: sourceForm.name.trim(),
      type: sourceForm.type,
      base_url: sourceForm.base_url.trim() || null,
      reliability_score: parseInt(sourceForm.reliability_score) || 70,
      is_active: sourceForm.is_active,
      fetch_strategy: sourceForm.fetch_strategy,
    };
    try {
      if (editingSourceId) {
        const { error } = await supabase.from("settlement_sources").update(payload).eq("id", editingSourceId);
        if (error) throw error;
        toast({ title: "Source updated" });
      } else {
        const { error } = await supabase.from("settlement_sources").insert(payload);
        if (error) throw error;
        toast({ title: "Source created" });
      }
      setSourceDialogOpen(false);
      fetchSources();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Edge Function Caller ────────────────────────────────
  const callEdgeFunction = async (functionName: string, setLoading: (v: boolean) => void) => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      toast({ title: "Success", description: data.message || JSON.stringify(data) });
    } catch (error) {
      toast({ title: "Error", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const effectiveDeadline = (s: Settlement) => s.claim_deadline || s.deadline;
  const reliabilityColor = (score: number) => score >= 85 ? "text-success" : score >= 60 ? "text-warning" : "text-critical";

  return (
    <div>
      <PageHeader title="Settlement Ingestion Engine" subtitle="Manage sources, review queue, and verified settlements">
        <Button size="sm" className="rounded-xl" onClick={openCreate}><Plus className="mr-1 h-3 w-3" />Add Settlement</Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("run-deadline-alerts", setSendingAlerts)} disabled={sendingAlerts}>
          <Send className="mr-1 h-3 w-3" />{sendingAlerts ? "Sending..." : "Send Alerts"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("rebuild-settlement-matches", setRebuildingMatches)} disabled={rebuildingMatches}>
          <RefreshCw className="mr-1 h-3 w-3" />{rebuildingMatches ? "Rebuilding..." : "Rebuild Matches"}
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-muted/50 rounded-xl">
          <TabsTrigger value="queue" className="rounded-lg gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Review Queue
            {queueItems.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{queueItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="verified" className="rounded-lg gap-1.5"><Shield className="h-3.5 w-3.5" /> Verified</TabsTrigger>
          <TabsTrigger value="sources" className="rounded-lg gap-1.5"><Globe className="h-3.5 w-3.5" /> Sources</TabsTrigger>
          <TabsTrigger value="raw" className="rounded-lg gap-1.5"><Database className="h-3.5 w-3.5" /> Raw Ingest</TabsTrigger>
        </TabsList>

        {/* ── REVIEW QUEUE ─────────────────────────── */}
        <TabsContent value="queue">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout Range</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deadline</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : queueItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">🎉 Queue is empty — all caught up!</td></tr>
                ) : (
                  queueItems.map((item) => {
                    const s = item.settlement;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{s?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{s?.company} · {s?.breach_year || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={item.reason === "new" ? "default" : "secondary"} className="text-xs">
                            {item.reason}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{item.priority}</td>
                        <td className="px-4 py-3 text-primary">${s?.payout_min || 0}–${(s?.payout_max || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">{s ? effectiveDeadline(s) || "—" : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-success hover:text-success" onClick={() => handleApprove(item)}>
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-critical hover:text-critical" onClick={() => handleReject(item)}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                            {s && (
                              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => openEdit(s)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── VERIFIED SETTLEMENTS ─────────────────── */}
        <TabsContent value="verified">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout Range</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deadline</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Verification</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settlementsLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : settlements.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No verified settlements</td></tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">{s.company}</td>
                      <td className="px-4 py-3">{s.breach_year || "—"}</td>
                      <td className="px-4 py-3 text-primary">${s.payout_min || 0}–${(s.payout_max || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">{effectiveDeadline(s) || "—"}</td>
                      <td className="px-4 py-3">
                        <VerificationBadge level={s.verification_level} verified={s.verified} compact />
                      </td>
                      <td className="px-4 py-3"><StatusPill variant={s.status as any} /></td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── SOURCES ──────────────────────────────── */}
        <TabsContent value="sources">
          <div className="mb-4">
            <Button size="sm" className="rounded-xl" onClick={openCreateSource}><Plus className="mr-1 h-3 w-3" />Add Source</Button>
          </div>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reliability</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Strategy</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sourcesLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : sources.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No sources</td></tr>
                ) : (
                  sources.map((src) => (
                    <tr key={src.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{src.name}</div>
                        {src.base_url && <a href={src.base_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-2.5 w-2.5" />{new URL(src.base_url).hostname}</a>}
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{src.type.replace("_", " ")}</Badge></td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-bold ${reliabilityColor(src.reliability_score)}`}>{src.reliability_score}</span>
                        <span className="text-muted-foreground">/100</span>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">{src.fetch_strategy.replace("_", " ")}</td>
                      <td className="px-4 py-3">{src.is_active ? <span className="text-success text-xs font-semibold">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openEditSource(src)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── RAW INGEST ────────────────────────────── */}
        <TabsContent value="raw">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Record ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name / Company</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fetched</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rawLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : rawIngest.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No raw ingest records</td></tr>
                ) : (
                  rawIngest.map((r) => (
                    <>
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs">{r.source?.name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.source_record_id || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs">{String(r.raw_payload?.name || "—")}</div>
                          <div className="text-xs text-muted-foreground">{String(r.raw_payload?.company || "")}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.fetched_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setExpandedRaw(expandedRaw === r.id ? null : r.id)}>
                              <Eye className="h-3.5 w-3.5" /> {expandedRaw === r.id ? "Hide" : "View"}
                            </Button>
                            {r.raw_url && (
                              <a href={r.raw_url} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost" className="h-7 gap-1"><ExternalLink className="h-3.5 w-3.5" /> URL</Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRaw === r.id && (
                        <tr key={`${r.id}-expanded`} className="border-b">
                          <td colSpan={5} className="px-4 py-3">
                            <pre className="text-xs bg-muted/50 rounded-xl p-4 overflow-x-auto max-h-60">
                              {JSON.stringify(r.raw_payload, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Settlement Create/Edit Dialog ──────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Settlement" : "Add Settlement"}</DialogTitle>
            <DialogDescription>{editingId ? "Update settlement details." : "Create a new settlement record."}</DialogDescription>
          </DialogHeader>

          {validationErrors.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-1">
              {validationErrors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
            </div>
          )}

          <div className="space-y-4">
            <Input placeholder="Settlement Name *" className="rounded-xl" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Company *" className="rounded-xl" value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} />
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Breach Year" type="number" className="rounded-xl" value={form.breach_year} onChange={(e) => setForm(f => ({ ...f, breach_year: e.target.value }))} />
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_breach">Data Breach</SelectItem>
                  <SelectItem value="privacy">Privacy</SelectItem>
                  <SelectItem value="consumer">Consumer</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Payout Min ($)" type="number" className="rounded-xl" value={form.payout_min} onChange={(e) => setForm(f => ({ ...f, payout_min: e.target.value }))} />
              <Input placeholder="Payout Max ($)" type="number" className="rounded-xl" value={form.payout_max} onChange={(e) => setForm(f => ({ ...f, payout_max: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Settlement Deadline</Label><Input type="date" className="rounded-xl" value={form.deadline} onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Claims Filing Deadline</Label><Input type="date" className="rounded-xl" value={form.claim_deadline} onChange={(e) => setForm(f => ({ ...f, claim_deadline: e.target.value }))} /></div>
            </div>
            <Textarea placeholder="Description" className="rounded-xl" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <Textarea placeholder="Eligibility Summary" className="rounded-xl" value={form.eligibility_summary} onChange={(e) => setForm(f => ({ ...f, eligibility_summary: e.target.value }))} rows={2} />
            <Input placeholder="Claim URL" className="rounded-xl" value={form.claim_url} onChange={(e) => setForm(f => ({ ...f, claim_url: e.target.value }))} />

            {/* Verification */}
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Verification</h3>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Verified</Label>
                <Switch checked={form.verified} onCheckedChange={(v) => setForm(f => ({ ...f, verified: v }))} />
              </div>
              <Select value={form.verification_level} onValueChange={(v) => setForm(f => ({ ...f, verification_level: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{VERIFICATION_LEVELS.map(vl => <SelectItem key={vl.value} value={vl.value}>{vl.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Jurisdiction" className="rounded-xl" value={form.jurisdiction} onChange={(e) => setForm(f => ({ ...f, jurisdiction: e.target.value }))} />
                <Input placeholder="Case Number" className="rounded-xl" value={form.case_number} onChange={(e) => setForm(f => ({ ...f, case_number: e.target.value }))} />
              </div>
              <Input placeholder="Administrator Name" className="rounded-xl" value={form.administrator_name} onChange={(e) => setForm(f => ({ ...f, administrator_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Official Source URL" className="rounded-xl" value={form.official_source_url} onChange={(e) => setForm(f => ({ ...f, official_source_url: e.target.value }))} />
                <Input placeholder="Claims Filing URL" className="rounded-xl" value={form.claims_filing_url} onChange={(e) => setForm(f => ({ ...f, claims_filing_url: e.target.value }))} />
              </div>
              <Textarea placeholder="Verification Notes" className="rounded-xl" value={form.verification_notes} onChange={(e) => setForm(f => ({ ...f, verification_notes: e.target.value }))} rows={2} />
            </div>

            <Textarea placeholder="Internal Notes (admin only)" className="rounded-xl" value={form.notes_internal} onChange={(e) => setForm(f => ({ ...f, notes_internal: e.target.value }))} rows={2} />

            <Button className="w-full rounded-xl" onClick={handleSave} disabled={saving || !form.name || !form.company}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Settlement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Source Dialog ──────────────────────────── */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="bg-card rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSourceId ? "Edit Source" : "Add Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Source Name *" className="rounded-xl" value={sourceForm.name} onChange={(e) => setSourceForm(f => ({ ...f, name: e.target.value }))} />
            <Select value={sourceForm.type} onValueChange={(v) => setSourceForm(f => ({ ...f, type: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="claims_admin">Claims Admin</SelectItem>
                <SelectItem value="court">Court</SelectItem>
                <SelectItem value="law_firm">Law Firm</SelectItem>
                <SelectItem value="aggregator">Aggregator</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Base URL" className="rounded-xl" value={sourceForm.base_url} onChange={(e) => setSourceForm(f => ({ ...f, base_url: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reliability (0-100)</Label>
                <Input type="number" min={0} max={100} className="rounded-xl" value={sourceForm.reliability_score} onChange={(e) => setSourceForm(f => ({ ...f, reliability_score: e.target.value }))} />
              </div>
              <Select value={sourceForm.fetch_strategy} onValueChange={(v) => setSourceForm(f => ({ ...f, fetch_strategy: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="edge_function">Edge Function</SelectItem>
                  <SelectItem value="import_csv">Import CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Active</Label>
              <Switch checked={sourceForm.is_active} onCheckedChange={(v) => setSourceForm(f => ({ ...f, is_active: v }))} />
            </div>
            <Button className="w-full rounded-xl" onClick={handleSaveSource} disabled={!sourceForm.name}>
              {editingSourceId ? "Save Changes" : "Add Source"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettlements;
