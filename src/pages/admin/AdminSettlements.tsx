import { useState, useEffect, useRef } from "react";
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
  Database, FileSearch, Shield, AlertTriangle, Eye, Globe, Upload, FileJson,
  Radar, Clock, BadgeCheck, Link2,
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
  submission_mode: string;
  is_test: boolean;
}

interface QueueItem {
  id: string;
  settlement_id: string;
  priority: number;
  reason: string;
  status: string;
  notes: string | null;
  created_at: string;
  changes_diff: Record<string, { old: any; new: any }> | null;
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

const REQUIRED_FIELDS = ["name", "company"] as const;
const OPTIONAL_FIELDS = [
  "breach_year", "claim_deadline", "payout_min", "payout_max",
  "eligibility_summary", "claim_url", "description", "category",
] as const;
const ALL_PAYLOAD_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const emptyForm = () => ({
  name: "", company: "", breach_year: "", status: "pending_review",
  payout_min: "", payout_max: "", deadline: "", description: "",
  verified: false, verification_level: "unverified",
  jurisdiction: "", case_number: "", administrator_name: "",
  official_source_url: "", claims_filing_url: "",
  claim_deadline: "", notes_internal: "",
  source_type: "", source_name: "", source_url: "",
  verification_notes: "", eligibility_summary: "", claim_url: "", category: "data_breach",
  submission_mode: "packet_only", is_test: false,
});

// ── Component ──────────────────────────────────────────
// Columns any signed-in user may read. Internal fields (notes, credibility
// score, author, source) come from an admin-only database function instead.
const SETTLEMENT_COLUMNS = [
  "id", "name", "company", "status", "breach_year", "payout_min", "payout_max",
  "deadline", "url", "description", "tags", "created_at", "updated_at",
  "verified", "verification_level", "jurisdiction", "case_number",
  "administrator_name", "official_source_url", "claims_filing_url",
  "claim_deadline", "source_type", "source_name", "source_url",
  "last_verified_at", "category", "final_approval_date",
  "eligibility_summary", "claim_url", "canonical_key",
  "verification_status", "media_references", "verification_sources",
  "submission_mode", "is_test", "is_demo", "discovered_at",
  "last_checked_at", "lifecycle_status", "closed_at", "eligibility_rules",
].join(",");

/** Adds the admin-only fields to settlement rows. */
async function withInternalFields<T extends { id: string }>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const { data, error } = await supabase.rpc("admin_settlement_internal" as never, { p_ids: rows.map((r) => r.id) } as never);
  if (error || !Array.isArray(data)) return rows;
  const byId = new Map((data as Array<{ id: string; internal: Record<string, unknown> }>).map((r) => [r.id, r.internal]));
  return rows.map((r) => ({ ...r, ...(byId.get(r.id) ?? {}) }));
}

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

  // Ingest dialog state
  const [ingestDialogOpen, setIngestDialogOpen] = useState(false);
  const [ingestJson, setIngestJson] = useState("");
  const [ingestSourceId, setIngestSourceId] = useState("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestSaving, setIngestSaving] = useState(false);

  // CSV upload state
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvSourceId, setCsvSourceId] = useState("");
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvStep, setCsvStep] = useState<"upload" | "map" | "preview">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved mapping templates
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; template_name: string; mapping_json: Record<string, string>; source_id: string | null }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [saveTemplateName, setSaveTemplateName] = useState("");

  // Diff view state
  const [diffItem, setDiffItem] = useState<QueueItem | null>(null);

  // Actions
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [rebuildingMatches, setRebuildingMatches] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);

  // Pending settlements
  const [pendingSettlements, setPendingSettlements] = useState<Settlement[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // Verification checks
  const [verificationChecks, setVerificationChecks] = useState<Record<string, any[]>>({});
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [checkSettlementId, setCheckSettlementId] = useState<string | null>(null);
  const [checkForm, setCheckForm] = useState({ check_type: "official_site", pass: true, evidence_url: "" });

  // Admin alerts
  const [adminAlerts, setAdminAlerts] = useState({ pending: 0, deadlineSoon: 0 });

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
      const { data: sRows } = await supabase.from("settlements").select(SETTLEMENT_COLUMNS).in("id", sIds);
      const sData = await withInternalFields((sRows || []) as unknown as Settlement[]);
      const sMap: Record<string, Settlement> = {};
      sData.forEach((s) => { sMap[s.id] = s; });
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
      .select(SETTLEMENT_COLUMNS)
      .in("status", ["verified", "open"])
      .order("created_at", { ascending: false });
    if (data) setSettlements(await withInternalFields(data as unknown as Settlement[]));
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

  const fetchTemplates = async () => {
    const { data } = await supabase.from("csv_mapping_templates").select("*").order("updated_at", { ascending: false });
    if (data) setSavedTemplates(data as any);
  };

  const fetchPending = async () => {
    setPendingLoading(true);
    const { data } = await supabase
      .from("settlements")
      .select(SETTLEMENT_COLUMNS)
      .in("status", ["pending_review", "pending"])
      .eq("is_demo", false)
      .order("discovered_at", { ascending: false });
    if (data) setPendingSettlements(await withInternalFields(data as unknown as Settlement[]));
    setPendingLoading(false);
  };

  const fetchAdminAlerts = async () => {
    const { count: pendingCount } = await supabase
      .from("settlements")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending_review", "pending"]);

    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    const { count: deadlineCount } = await supabase
      .from("settlements")
      .select("id", { count: "exact", head: true })
      .eq("status", "verified")
      .lte("claim_deadline", in14Days.toISOString().split("T")[0])
      .gte("claim_deadline", new Date().toISOString().split("T")[0]);

    setAdminAlerts({ pending: pendingCount || 0, deadlineSoon: deadlineCount || 0 });
  };

  const fetchVerificationChecks = async (settlementId: string) => {
    const { data } = await supabase
      .from("settlement_verification_checks")
      .select("*")
      .eq("settlement_id", settlementId)
      .order("created_at", { ascending: false });
    setVerificationChecks(prev => ({ ...prev, [settlementId]: data || [] }));
  };

  const handleAddCheck = async () => {
    if (!checkSettlementId) return;
    try {
      const { error } = await supabase.from("settlement_verification_checks").insert({
        settlement_id: checkSettlementId,
        check_type: checkForm.check_type,
        pass: checkForm.pass,
        evidence: { url: checkForm.evidence_url },
      });
      if (error) throw error;
      toast({ title: "Verification check added" });
      fetchVerificationChecks(checkSettlementId);
      setCheckDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAdminVerify = async (settlementId: string, decision: "approve" | "reject") => {
    try {
      const { error } = await supabase.rpc("rpc_admin_verify_settlement", {
        p_settlement_id: settlementId,
        p_decision: decision,
        p_notes: `Verified by admin via UI`,
      });
      if (error) throw error;
      toast({ title: decision === "approve" ? "Settlement verified" : "Settlement rejected" });
      fetchPending();
      fetchSettlements();
      fetchQueue();
      fetchAdminAlerts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchQueue();
    fetchSettlements();
    fetchSources();
    fetchRawIngest();
    fetchTemplates();
    fetchPending();
    fetchAdminAlerts();
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
      submission_mode: s.submission_mode || "packet_only",
      is_test: s.is_test || false,
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
      submission_mode: form.submission_mode,
      is_test: form.is_test,
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

  // ── Manual JSON Ingest ─────────────────────────────────
  const handleIngestSubmit = async () => {
    if (!ingestJson.trim()) { toast({ title: "JSON payload required", variant: "destructive" }); return; }
    setIngestSaving(true);
    try {
      const parsed = JSON.parse(ingestJson);
      if (!parsed.name || !parsed.company) throw new Error("Payload must include 'name' and 'company'");

      const contentHash = btoa(JSON.stringify(parsed)).slice(0, 64);

      const { data: row, error: insertError } = await supabase.from("settlement_raw_ingest").insert({
        source_id: ingestSourceId || null,
        raw_url: ingestUrl.trim() || null,
        raw_payload: parsed,
        content_hash: contentHash,
      }).select("id").single();

      if (insertError) throw insertError;

      // Run normalization
      const { error: normError } = await supabase.rpc("normalize_raw_ingest", { p_ingest_id: row.id });
      if (normError) throw normError;

      toast({ title: "Ingested & normalized", description: `Settlement "${parsed.name}" added to review queue.` });
      setIngestDialogOpen(false);
      setIngestJson("");
      setIngestSourceId("");
      setIngestUrl("");
      fetchRawIngest();
      fetchQueue();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIngestSaving(false);
    }
  };

  // ── CSV Upload ─────────────────────────────────────────
  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast({ title: "CSV must have header + data rows", variant: "destructive" }); return; }

      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] || ""; });
        return row;
      });

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map matching headers
      const autoMap: Record<string, string> = {};
      headers.forEach(h => {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const match = ALL_PAYLOAD_FIELDS.find(f => f === lower || f === h.toLowerCase());
        if (match) autoMap[h] = match;
      });
      setCsvMapping(autoMap);
      setCsvStep("map");
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    setCsvUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const row of csvRows) {
        const payload: Record<string, any> = {};
        Object.entries(csvMapping).forEach(([csvCol, payloadField]) => {
          if (payloadField && row[csvCol]) {
            payload[payloadField] = row[csvCol];
          }
        });

        if (!payload.name || !payload.company) { errorCount++; continue; }

        const contentHash = btoa(JSON.stringify(payload)).slice(0, 64);

        try {
          const { data: ingestRow, error: ie } = await supabase.from("settlement_raw_ingest").insert({
            source_id: csvSourceId || null,
            raw_payload: payload,
            content_hash: contentHash,
          }).select("id").single();

          if (ie) { errorCount++; continue; }

          await supabase.rpc("normalize_raw_ingest", { p_ingest_id: ingestRow.id });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      toast({
        title: "CSV Import Complete",
        description: `${successCount} ingested, ${errorCount} failed out of ${csvRows.length} rows.`,
      });

      setCsvDialogOpen(false);
      setCsvStep("upload");
      setCsvRows([]);
      setCsvHeaders([]);
      setCsvMapping({});
      fetchRawIngest();
      fetchQueue();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setCsvUploading(false);
    }
  };

  // ── Save CSV Template ──────────────────────────────────
  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) { toast({ title: "Template name required", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from("csv_mapping_templates").insert({
        template_name: saveTemplateName.trim(),
        source_id: csvSourceId || null,
        mapping_json: csvMapping,
      });
      if (error) throw error;
      toast({ title: "Template saved" });
      setSaveTemplateName("");
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const applyTemplate = (templateId: string) => {
    const tpl = savedTemplates.find(t => t.id === templateId);
    if (tpl) {
      setCsvMapping(tpl.mapping_json as Record<string, string>);
      if (tpl.source_id) setCsvSourceId(tpl.source_id);
      setSelectedTemplateId(templateId);
    }
  };


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
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setIngestDialogOpen(true); setIngestJson(""); setIngestSourceId(""); setIngestUrl(""); }}>
          <FileJson className="mr-1 h-3 w-3" />Add Raw Ingest
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setCsvDialogOpen(true); setCsvStep("upload"); setCsvRows([]); setCsvHeaders([]); }}>
          <Upload className="mr-1 h-3 w-3" />CSV Upload
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("run-deadline-alerts", setSendingAlerts)} disabled={sendingAlerts}>
          <Send className="mr-1 h-3 w-3" />{sendingAlerts ? "Sending..." : "Send Alerts"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("rebuild-settlement-matches", setRebuildingMatches)} disabled={rebuildingMatches}>
          <RefreshCw className="mr-1 h-3 w-3" />{rebuildingMatches ? "Rebuilding..." : "Rebuild Matches"}
        </Button>
        <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => callEdgeFunction("run-settlement-discovery", setRunningDiscovery)} disabled={runningDiscovery}>
          <Radar className="mr-1 h-3 w-3" />{runningDiscovery ? "Discovering..." : "Run Discovery"}
        </Button>
      </PageHeader>

      {/* Admin Alerts Bar */}
      {(adminAlerts.pending > 0 || adminAlerts.deadlineSoon > 0) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {adminAlerts.pending > 0 && (
            <div className="glass-card px-4 py-2 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-medium">{adminAlerts.pending}</span>
              <span className="text-muted-foreground">pending settlements</span>
            </div>
          )}
          {adminAlerts.deadlineSoon > 0 && (
            <div className="glass-card px-4 py-2 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-critical" />
              <span className="font-medium">{adminAlerts.deadlineSoon}</span>
              <span className="text-muted-foreground">deadlines within 14 days</span>
            </div>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-muted/50 rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg gap-1.5">
            <Radar className="h-3.5 w-3.5" /> Pending
            {pendingSettlements.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingSettlements.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="queue" className="rounded-lg gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Review Queue
            {queueItems.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{queueItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="verified" className="rounded-lg gap-1.5"><Shield className="h-3.5 w-3.5" /> Verified</TabsTrigger>
          <TabsTrigger value="sources" className="rounded-lg gap-1.5"><Globe className="h-3.5 w-3.5" /> Sources</TabsTrigger>
          <TabsTrigger value="raw" className="rounded-lg gap-1.5"><Database className="h-3.5 w-3.5" /> Raw Ingest</TabsTrigger>
        </TabsList>

        {/* ── PENDING SETTLEMENTS (Discovery) ────── */}
        <TabsContent value="pending">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deadline</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Checks</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : pendingSettlements.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No pending settlements. Run discovery to find new ones.</td></tr>
                ) : (
                  pendingSettlements.map((s) => {
                    const checks = verificationChecks[s.id] || [];
                    const passCount = checks.filter(c => c.pass).length;
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.company} · {s.breach_year || "—"}</div>
                          {s.claim_url && (
                            <a href={s.claim_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                              <Link2 className="h-2.5 w-2.5" /> {new URL(s.claim_url).hostname}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] capitalize">{s.source_type || "unknown"}</Badge>
                          {s.source_url && (
                            <a href={s.source_url} target="_blank" rel="noreferrer" className="block text-[10px] text-primary hover:underline mt-0.5 truncate max-w-32">
                              <ExternalLink className="h-2.5 w-2.5 inline mr-0.5" />source
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-primary text-xs">${s.payout_min || 0}–${(s.payout_max || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs">{effectiveDeadline(s) || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-mono ${passCount >= 2 ? "text-success" : passCount >= 1 ? "text-warning" : "text-muted-foreground"}`}>
                              {passCount} pass
                            </span>
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => {
                              fetchVerificationChecks(s.id);
                              setCheckSettlementId(s.id);
                              setCheckDialogOpen(true);
                            }}>
                              + Add
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-success hover:text-success" onClick={() => handleAdminVerify(s.id, "approve")}>
                              <BadgeCheck className="h-3.5 w-3.5" /> Verify
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-critical hover:text-critical" onClick={() => handleAdminVerify(s.id, "reject")}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => openEdit(s)}>
                              <Pencil className="h-3.5 w-3.5" />
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
        </TabsContent>

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
                            {item.changes_diff && Object.keys(item.changes_diff).length > 0 && (
                              <Button size="sm" variant="ghost" className="h-7 gap-1 text-warning hover:text-warning" onClick={() => setDiffItem(item)}>
                                <FileSearch className="h-3.5 w-3.5" /> Diff
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

            {/* Submission Mode & Test Toggle */}
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Submission Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Submission Mode</Label>
                  <Select value={form.submission_mode} onValueChange={(v) => setForm(f => ({ ...f, submission_mode: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="packet_only">Packet Only</SelectItem>
                      <SelectItem value="redirect_official">Redirect to Official Site</SelectItem>
                      <SelectItem value="partner_api">Partner API (Direct)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Test Settlement</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={form.is_test} onCheckedChange={(v) => setForm(f => ({ ...f, is_test: v }))} />
                    <span className="text-xs text-muted-foreground">{form.is_test ? "Test mode" : "Production"}</span>
                  </div>
                </div>
              </div>
            </div>

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

      {/* ── Manual JSON Ingest Dialog ─────────────── */}
      <Dialog open={ingestDialogOpen} onOpenChange={setIngestDialogOpen}>
        <DialogContent className="bg-card rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Raw Ingest</DialogTitle>
            <DialogDescription>Paste a JSON payload to ingest and normalize into a settlement record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={ingestSourceId} onValueChange={setIngestSourceId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select source (optional)" /></SelectTrigger>
              <SelectContent>
                {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Source URL (optional)" className="rounded-xl" value={ingestUrl} onChange={(e) => setIngestUrl(e.target.value)} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">JSON Payload (must include "name" and "company")</Label>
              <Textarea
                className="rounded-xl font-mono text-xs"
                rows={10}
                placeholder={`{\n  "name": "T-Mobile Data Breach Settlement",\n  "company": "T-Mobile",\n  "claim_deadline": "2026-09-30",\n  "payout_min": 25,\n  "payout_max": 5000,\n  "eligibility_summary": "Affected customers...",\n  "claim_url": "https://...",\n  "category": "data_breach",\n  "breach_year": 2021\n}`}
                value={ingestJson}
                onChange={(e) => setIngestJson(e.target.value)}
              />
            </div>
            <Button className="w-full rounded-xl" onClick={handleIngestSubmit} disabled={ingestSaving || !ingestJson.trim()}>
              {ingestSaving ? "Ingesting..." : "Ingest & Normalize"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CSV Upload Dialog ─────────────────────── */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="bg-card rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSV Import</DialogTitle>
            <DialogDescription>
              {csvStep === "upload" && "Upload a CSV file with settlement data."}
              {csvStep === "map" && `Map your ${csvHeaders.length} CSV columns to settlement fields.`}
              {csvStep === "preview" && `Preview ${csvRows.length} rows before importing.`}
            </DialogDescription>
          </DialogHeader>

          {csvStep === "upload" && (
            <div className="space-y-4">
              <Select value={csvSourceId} onValueChange={setCsvSourceId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select source (optional)" /></SelectTrigger>
                <SelectContent>
                  {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div
                className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Headers will be auto-detected</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
            </div>
          )}

          {csvStep === "map" && (
            <div className="space-y-4">
              {/* Saved template selector */}
              {savedTemplates.length > 0 && (
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Use Saved Template</p>
                  <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select a saved mapping template" /></SelectTrigger>
                    <SelectContent>
                      {savedTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Column Mapping</p>
                {csvHeaders.map(header => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="text-sm font-mono w-40 truncate">{header}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={csvMapping[header] || "_skip"}
                      onValueChange={(v) => setCsvMapping(m => ({ ...m, [header]: v === "_skip" ? "" : v }))}
                    >
                      <SelectTrigger className="rounded-xl flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">— Skip —</SelectItem>
                        {ALL_PAYLOAD_FIELDS.map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{csvRows.length} data rows detected. "name" and "company" mappings are required.</p>
              
              {/* Save as template */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Save mapping as template..."
                  className="rounded-xl flex-1 text-xs"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                />
                <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>
                  Save Template
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setCsvStep("upload")}>Back</Button>
                <Button
                  className="rounded-xl flex-1"
                  disabled={!Object.values(csvMapping).includes("name") || !Object.values(csvMapping).includes("company")}
                  onClick={() => setCsvStep("preview")}
                >
                  Preview ({csvRows.length} rows)
                </Button>
              </div>
            </div>
          )}

          {csvStep === "preview" && (
            <div className="space-y-4">
              <div className="rounded-xl border overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      {Object.entries(csvMapping).filter(([, v]) => v).map(([, field]) => (
                        <th key={field} className="px-3 py-2 text-left font-medium">{field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b">
                        {Object.entries(csvMapping).filter(([, v]) => v).map(([csvCol, field]) => (
                          <td key={field} className="px-3 py-1.5 truncate max-w-32">{row[csvCol] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvRows.length > 10 && <p className="text-xs text-muted-foreground">Showing first 10 of {csvRows.length} rows</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setCsvStep("map")}>Back</Button>
                <Button className="rounded-xl flex-1" onClick={handleCsvImport} disabled={csvUploading}>
                  {csvUploading ? "Importing..." : `Import ${csvRows.length} Rows`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Verification Check Dialog ─────────────── */}
      <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
        <DialogContent className="bg-card rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add Verification Check</DialogTitle>
            <DialogDescription>Add a verification check for this settlement to meet approval requirements.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={checkForm.check_type} onValueChange={(v) => setCheckForm(f => ({ ...f, check_type: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="official_site">Official Site Verified</SelectItem>
                <SelectItem value="claims_admin">Claims Administrator</SelectItem>
                <SelectItem value="court_reference">Court Reference</SelectItem>
                <SelectItem value="deadline_present">Deadline Present</SelectItem>
                <SelectItem value="payout_present">Payout Info Present</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Evidence URL"
              className="rounded-xl"
              value={checkForm.evidence_url}
              onChange={(e) => setCheckForm(f => ({ ...f, evidence_url: e.target.value }))}
            />
            <div className="flex items-center justify-between">
              <Label>Pass</Label>
              <Switch checked={checkForm.pass} onCheckedChange={(v) => setCheckForm(f => ({ ...f, pass: v }))} />
            </div>
            {/* Show existing checks */}
            {checkSettlementId && verificationChecks[checkSettlementId]?.length > 0 && (
              <div className="space-y-1 rounded-xl border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Existing Checks</p>
                {verificationChecks[checkSettlementId].map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    {c.pass ? <Check className="h-3 w-3 text-success" /> : <X className="h-3 w-3 text-critical" />}
                    <span className="capitalize">{c.check_type.replace(/_/g, " ")}</span>
                    {c.evidence?.url && (
                      <a href={c.evidence.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full rounded-xl" onClick={handleAddCheck}>
              Add Check
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Diff View Dialog ──────────────────────── */}
      <Dialog open={!!diffItem} onOpenChange={(open) => !open && setDiffItem(null)}>
        <DialogContent className="bg-card rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>What Changed</DialogTitle>
            <DialogDescription>
              {diffItem?.settlement?.name || "Settlement"} — changes detected during re-ingest
            </DialogDescription>
          </DialogHeader>
          {diffItem?.changes_diff && (
            <div className="space-y-3">
              {Object.entries(diffItem.changes_diff).map(([field, change]) => (
                <div key={field} className="rounded-xl border p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{field.replace(/_/g, " ")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-2">
                      <p className="text-[10px] text-destructive font-medium mb-0.5">Previous</p>
                      <p className="text-sm">{change.old != null ? String(change.old) : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-warning/5 border border-warning/10 p-2">
                      <p className="text-[10px] text-warning font-medium mb-0.5">New</p>
                      <p className="text-sm font-medium">{change.new != null ? String(change.new) : "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettlements;
