import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Send, Zap, RefreshCw, Pencil, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
}

const VERIFICATION_LEVELS = [
  { value: "unverified", label: "Unverified" },
  { value: "source_linked", label: "Source Linked" },
  { value: "court_verified", label: "Court Verified" },
  { value: "administrator_confirmed", label: "Administrator Confirmed" },
];

const emptyForm = () => ({
  name: "", company: "", breach_year: "", status: "open",
  payout_min: "", payout_max: "", deadline: "", description: "",
  verified: false, verification_level: "unverified",
  jurisdiction: "", case_number: "", administrator_name: "",
  official_source_url: "", claims_filing_url: "",
  claim_deadline: "", notes_internal: "",
  source_type: "", source_name: "", source_url: "",
  verification_notes: "",
});

const AdminSettlements = () => {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [rebuildingMatches, setRebuildingMatches] = useState(false);
  const [runningScan, setRunningScan] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fetchSettlements = async () => {
    const { data } = await supabase
      .from("settlements")
      .select("id, name, company, breach_year, status, payout_min, payout_max, deadline, description, verified, verification_level, jurisdiction, case_number, administrator_name, official_source_url, claims_filing_url, claim_deadline, notes_internal, source_type, source_name, source_url, verification_notes, last_verified_at")
      .order("created_at", { ascending: false });
    if (data) setSettlements(data as Settlement[]);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchSettlements(); }, [user]);

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
    if (form.verification_level !== "unverified") {
      if (!form.official_source_url.trim() && !form.claims_filing_url.trim()) {
        errors.push("Non-unverified level requires at least one URL.");
      }
      if (!form.jurisdiction.trim()) {
        errors.push("Non-unverified level requires a jurisdiction.");
      }
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
    };

    // Auto-update last_verified_at when verified changes to true
    if (form.verified) {
      payload.last_verified_at = new Date().toISOString();
    }

    try {
      if (editingId) {
        const { error } = await supabase.from("settlements").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Settlement updated" });
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("settlements").insert(payload);
        if (error) throw error;
        toast({ title: "Settlement created" });
      }
      setDialogOpen(false);
      fetchSettlements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const callEdgeFunction = async (functionName: string, loadingState: [boolean, (v: boolean) => void]) => {
    const [, setLoadingState] = loadingState;
    setLoadingState(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let title = "Success";
      let description = "";
      if (functionName === "run-deadline-alerts") {
        description = data.alerts_sent ? `Sent ${data.alerts_sent} deadline alerts` : data.message || "Alerts sent";
      } else if (functionName === "rebuild-settlement-matches") {
        description = data.created ? `Created ${data.created} settlement matches` : data.message || "Rebuild completed";
      } else if (functionName === "run-scheduled-scans") {
        description = data.scans_initiated ? `Initiated ${data.scans_initiated} scans` : data.message || "Scans initiated";
      }
      if (data.message && !data.success && !data.created && !data.alerts_sent && !data.scans_initiated) title = "Info";
      toast({ title, description });
    } catch (error) {
      toast({ title: "Error", description: `Failed to trigger ${functionName}: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
    } finally {
      setLoadingState(false);
    }
  };

  const effectiveDeadline = (s: Settlement) => s.claim_deadline || s.deadline;

  return (
    <div>
      <PageHeader title="Settlement Management" subtitle="Manage settlement records and verification">
        <Button size="sm" className="rounded-xl" onClick={openCreate}><Plus className="mr-1 h-3 w-3" />Add Settlement</Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("run-deadline-alerts", [sendingAlerts, setSendingAlerts])} disabled={sendingAlerts}>
          <Send className="mr-1 h-3 w-3" />{sendingAlerts ? "Sending..." : "Send Alerts"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("rebuild-settlement-matches", [rebuildingMatches, setRebuildingMatches])} disabled={rebuildingMatches}>
          <RefreshCw className="mr-1 h-3 w-3" />{rebuildingMatches ? "Rebuilding..." : "Rebuild Matches"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => callEdgeFunction("run-scheduled-scans", [runningScan, setRunningScan])} disabled={runningScan}>
          <Zap className="mr-1 h-3 w-3" />{runningScan ? "Scanning..." : "Run Scans"}
        </Button>
      </PageHeader>

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
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : settlements.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No settlements yet</td></tr>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Settlement" : "Add Settlement"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update settlement details and verification status." : "Create a new settlement record."}
            </DialogDescription>
          </DialogHeader>

          {validationErrors.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-1">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-sm text-destructive">{e}</p>
              ))}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h3>
              <Input placeholder="Settlement Name *" className="rounded-xl" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Company *" className="rounded-xl" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Breach Year" type="number" className="rounded-xl" value={form.breach_year} onChange={(e) => setForm((f) => ({ ...f, breach_year: e.target.value }))} />
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Payout Min ($)" type="number" className="rounded-xl" value={form.payout_min} onChange={(e) => setForm((f) => ({ ...f, payout_min: e.target.value }))} />
                <Input placeholder="Payout Max ($)" type="number" className="rounded-xl" value={form.payout_max} onChange={(e) => setForm((f) => ({ ...f, payout_max: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Settlement Deadline</Label>
                  <Input type="date" className="rounded-xl" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Claims Filing Deadline</Label>
                  <Input type="date" className="rounded-xl" value={form.claim_deadline} onChange={(e) => setForm((f) => ({ ...f, claim_deadline: e.target.value }))} />
                </div>
              </div>
              <Textarea placeholder="Description" className="rounded-xl" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            {/* Verification */}
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Verification</h3>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Verified Settlement</Label>
                <Switch checked={form.verified} onCheckedChange={(v) => setForm((f) => ({ ...f, verified: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Verification Level</Label>
                <Select value={form.verification_level} onValueChange={(v) => setForm((f) => ({ ...f, verification_level: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_LEVELS.map((vl) => (
                      <SelectItem key={vl.value} value={vl.value}>{vl.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Jurisdiction</Label>
                  <Input placeholder="e.g. Southern District of CA" className="rounded-xl" value={form.jurisdiction} onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Case Number</Label>
                  <Input placeholder="e.g. 3:21-cv-00001" className="rounded-xl" value={form.case_number} onChange={(e) => setForm((f) => ({ ...f, case_number: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Administrator Name</Label>
                <Input placeholder="e.g. Epiq Global" className="rounded-xl" value={form.administrator_name} onChange={(e) => setForm((f) => ({ ...f, administrator_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Official Source URL</Label>
                  <Input placeholder="https://..." className="rounded-xl" value={form.official_source_url} onChange={(e) => setForm((f) => ({ ...f, official_source_url: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Claims Filing URL</Label>
                  <Input placeholder="https://..." className="rounded-xl" value={form.claims_filing_url} onChange={(e) => setForm((f) => ({ ...f, claims_filing_url: e.target.value }))} />
                </div>
              </div>

              {/* Source fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Source Type</Label>
                  <Select value={form.source_type || "none"} onValueChange={(v) => setForm((f) => ({ ...f, source_type: v === "none" ? "" : v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="court_filing">Court Filing</SelectItem>
                      <SelectItem value="news_article">News Article</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="administrator">Administrator</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Source Name</Label>
                  <Input placeholder="e.g. Reuters" className="rounded-xl" value={form.source_name} onChange={(e) => setForm((f) => ({ ...f, source_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Source URL</Label>
                  <Input placeholder="https://..." className="rounded-xl" value={form.source_url} onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Verification Notes</Label>
                <Textarea placeholder="Notes about verification process..." className="rounded-xl" value={form.verification_notes} onChange={(e) => setForm((f) => ({ ...f, verification_notes: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Live Preview */}
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">User Preview</p>
              <VerificationBadge
                level={form.verification_level}
                verified={form.verified}
                sourceUrl={form.official_source_url || form.source_url || undefined}
              />
              {form.jurisdiction && <p className="text-xs text-muted-foreground ml-6.5">Jurisdiction: {form.jurisdiction}</p>}
              {form.case_number && <p className="text-xs text-muted-foreground ml-6.5">Case: {form.case_number}</p>}
              {form.administrator_name && <p className="text-xs text-muted-foreground ml-6.5">Administrator: {form.administrator_name}</p>}
              {form.claims_filing_url && (
                <span className="inline-flex items-center gap-1 text-[10px] text-primary ml-6.5"><ExternalLink className="h-2.5 w-2.5" /> Claims filing site</span>
              )}
            </div>

            {/* Internal Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Internal Notes (admin only)</Label>
              <Textarea placeholder="Internal notes..." className="rounded-xl" value={form.notes_internal} onChange={(e) => setForm((f) => ({ ...f, notes_internal: e.target.value }))} rows={2} />
            </div>

            <Button className="w-full rounded-xl" onClick={handleSave} disabled={saving || !form.name || !form.company}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Settlement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettlements;
