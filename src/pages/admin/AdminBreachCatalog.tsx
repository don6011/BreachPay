import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RefreshCw, Plus, Pencil, ExternalLink, ShieldCheck, ShieldAlert,
  Search, Database, CheckCircle, XCircle, Sparkles,
} from "lucide-react";

interface BreachCatalogItem {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  severity: string;
  exposed_fields: string;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  verified: boolean;
  tags: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM: Omit<BreachCatalogItem, "id" | "created_at" | "updated_at"> = {
  name: "",
  company: "",
  breach_year: null,
  severity: "medium",
  exposed_fields: "",
  source_type: "public",
  source_name: null,
  source_url: null,
  verified: true,
  tags: [],
  active: true,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  public: "Public",
  regulator: "Regulator",
  court: "Court",
  press: "Press",
  company: "Company",
};

const AdminBreachCatalog = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BreachCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [filterVerified, setFilterVerified] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BreachCatalogItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("breach_catalog")
      .select("*")
      .order("company", { ascending: true })
      .order("breach_year", { ascending: false });
    if (error) {
      toast.error("Failed to load catalog");
    } else {
      setItems((data || []) as BreachCatalogItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase();
      if (q && !i.name.toLowerCase().includes(q) && !i.company.toLowerCase().includes(q)) return false;
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      if (filterActive === "active" && !i.active) return false;
      if (filterActive === "inactive" && i.active) return false;
      if (filterVerified === "verified" && !i.verified) return false;
      if (filterVerified === "unverified" && i.verified) return false;
      return true;
    });
  }, [items, search, filterSeverity, filterActive, filterVerified]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (item: BreachCatalogItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      company: item.company,
      breach_year: item.breach_year,
      severity: item.severity,
      exposed_fields: item.exposed_fields,
      source_type: item.source_type,
      source_name: item.source_name,
      source_url: item.source_url,
      verified: item.verified,
      tags: item.tags,
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.company || !form.exposed_fields) {
      toast.error("Name, company, and exposed fields are required");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags,
    };

    if (editing) {
      const { error } = await supabase
        .from("breach_catalog")
        .update(payload as any)
        .eq("id", editing.id);
      if (error) toast.error("Update failed");
      else toast.success("Entry updated");
    } else {
      const { error } = await supabase
        .from("breach_catalog")
        .insert(payload as any);
      if (error) toast.error("Insert failed: " + error.message);
      else toast.success("Entry created");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchItems();
  };

  const toggleField = async (item: BreachCatalogItem, field: "active" | "verified") => {
    const { error } = await supabase
      .from("breach_catalog")
      .update({ [field]: !item[field] } as any)
      .eq("id", item.id);
    if (error) toast.error("Toggle failed");
    else {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [field]: !i[field] } : i)));
    }
  };

  const seedCatalog = async () => {
    setSeeding(true);
    const seedData = [
      { name: "Equifax 2017 Data Breach", company: "Equifax", breach_year: 2017, severity: "critical", exposed_fields: "ssn, address, name, dob", source_type: "regulator", source_name: "FTC", verified: true, tags: ["credit", "identity"], active: true },
      { name: "LinkedIn 2012 Credential Exposure", company: "LinkedIn", breach_year: 2012, severity: "high", exposed_fields: "email, password", source_type: "press", source_name: "Public reporting", verified: true, tags: ["social", "credentials"], active: true },
      { name: "T-Mobile 2021 Customer Data Incident", company: "T-Mobile", breach_year: 2021, severity: "critical", exposed_fields: "ssn, phone, address", source_type: "company", source_name: "Company notice", verified: true, tags: ["telecom", "identity"], active: true },
      { name: "Adobe 2013 Account Breach", company: "Adobe", breach_year: 2013, severity: "high", exposed_fields: "email, password, username", source_type: "press", source_name: "Public reporting", verified: true, tags: ["credentials", "software"], active: true },
      { name: "Canva 2019 User Data Incident", company: "Canva", breach_year: 2019, severity: "medium", exposed_fields: "email, username", source_type: "press", source_name: "Public reporting", verified: true, tags: ["design"], active: true },
      { name: "Dropbox 2012 Password Exposure", company: "Dropbox", breach_year: 2012, severity: "high", exposed_fields: "email, password", source_type: "press", source_name: "Public reporting", verified: true, tags: ["cloud", "credentials"], active: true },
      { name: "MyFitnessPal 2018 Account Breach", company: "MyFitnessPal", breach_year: 2018, severity: "medium", exposed_fields: "email, password, username", source_type: "press", source_name: "Public reporting", verified: true, tags: ["fitness"], active: true },
      { name: "Twitter 2022 Account Data Incident", company: "Twitter", breach_year: 2022, severity: "medium", exposed_fields: "email, phone", source_type: "press", source_name: "Public reporting", verified: true, tags: ["social"], active: true },
      { name: "Marriott 2018 Guest Data Incident", company: "Marriott", breach_year: 2018, severity: "high", exposed_fields: "name, passport, email, phone", source_type: "company", source_name: "Company notice", verified: true, tags: ["travel", "identity"], active: true },
      { name: "AT&T 2024 Customer Data Exposure", company: "AT&T", breach_year: 2024, severity: "high", exposed_fields: "phone, address", source_type: "press", source_name: "Public reporting", verified: true, tags: ["telecom"], active: true },
    ];

    const { error } = await supabase.from("breach_catalog").insert(seedData as any);
    if (error) {
      if (error.message.includes("duplicate")) toast.info("Catalog already has data");
      else toast.error("Seed failed: " + error.message);
    } else {
      toast.success("Demo catalog seeded!");
      fetchItems();
    }
    setSeeding(false);
  };

  return (
    <div>
      <PageHeader title="Breach Catalog" subtitle="Manage breach sources that fuel scan matching">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={seedCatalog} disabled={seeding || items.length > 0}>
            <Sparkles className={`mr-1 h-3 w-3 ${seeding ? "animate-spin" : ""}`} />
            Seed Demo Catalog
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-1 h-3 w-3" />
            Add Entry
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or company…"
            className="pl-9 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[130px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVerified} onValueChange={setFilterVerified}>
          <SelectTrigger className="w-[130px] rounded-xl"><SelectValue placeholder="Verified" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Breach</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Severity</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Exposed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  <Database className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No catalog entries found
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{item.company}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.breach_year || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs capitalize ${SEVERITY_COLORS[item.severity] || ""}`}>
                      {item.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">{item.exposed_fields}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {item.verified ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs">
                        {SOURCE_TYPE_LABELS[item.source_type] || item.source_type}
                        {item.source_name ? ` · ${item.source_name}` : ""}
                      </span>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleField(item, "active")} className="flex items-center gap-1 text-xs" title="Toggle active">
                        {item.active ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={item.active ? "text-primary" : "text-muted-foreground"}>{item.active ? "Active" : "Off"}</span>
                      </button>
                      <button onClick={() => toggleField(item, "verified")} className="flex items-center gap-1 text-xs" title="Toggle verified">
                        {item.verified ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> : <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={item.verified ? "text-primary" : "text-muted-foreground"}>{item.verified ? "Verified" : "Unverified"}</span>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="rounded-lg h-7 w-7 p-0" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Breach Entry" : "New Breach Entry"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input className="rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Equifax 2017 Data Breach" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Company *</Label>
                <Input className="rounded-xl" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Equifax" />
              </div>
              <div className="grid gap-1.5">
                <Label>Breach Year</Label>
                <Input className="rounded-xl" type="number" value={form.breach_year ?? ""} onChange={(e) => setForm({ ...form, breach_year: e.target.value ? parseInt(e.target.value) : null })} placeholder="e.g. 2017" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Severity *</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Source Type</Label>
                <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="regulator">Regulator</SelectItem>
                    <SelectItem value="court">Court</SelectItem>
                    <SelectItem value="press">Press</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Exposed Fields *</Label>
              <Input className="rounded-xl" value={form.exposed_fields} onChange={(e) => setForm({ ...form, exposed_fields: e.target.value })} placeholder="e.g. ssn, address, name, dob" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Source Name</Label>
                <Input className="rounded-xl" value={form.source_name ?? ""} onChange={(e) => setForm({ ...form, source_name: e.target.value || null })} placeholder="e.g. FTC" />
              </div>
              <div className="grid gap-1.5">
                <Label>Source URL</Label>
                <Input className="rounded-xl" value={form.source_url ?? ""} onChange={(e) => setForm({ ...form, source_url: e.target.value || null })} placeholder="https://..." />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input className="rounded-xl" value={form.tags.join(", ")} onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="e.g. credit, identity" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.verified} onCheckedChange={(v) => setForm({ ...form, verified: v })} />
                <Label>Verified</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBreachCatalog;
