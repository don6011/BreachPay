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
  data_types: string[];
  records_exposed: number | null;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  verified: boolean;
  verification_status: string;
  tags: string[];
  active: boolean;
  settlement_available: boolean;
  settlement_name: string | null;
  estimated_payout_min: number | null;
  estimated_payout_max: number | null;
  claim_deadline: string | null;
  law_firm_partner: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM: Omit<BreachCatalogItem, "id" | "created_at" | "updated_at"> = {
  name: "",
  company: "",
  breach_year: null,
  severity: "medium",
  exposed_fields: "",
  data_types: [],
  records_exposed: null,
  source_type: "public",
  source_name: null,
  source_url: null,
  verified: true,
  verification_status: "pending",
  tags: [],
  active: true,
  settlement_available: false,
  settlement_name: null,
  estimated_payout_min: null,
  estimated_payout_max: null,
  claim_deadline: null,
  law_firm_partner: null,
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
  const [filterSettlement, setFilterSettlement] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BreachCatalogItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  

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
      if (filterSettlement === "yes" && !i.settlement_available) return false;
      if (filterSettlement === "no" && i.settlement_available) return false;
      return true;
    });
  }, [items, search, filterSeverity, filterActive, filterVerified, filterSettlement]);

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
      data_types: item.data_types || [],
      records_exposed: item.records_exposed,
      source_type: item.source_type,
      source_name: item.source_name,
      source_url: item.source_url,
      verified: item.verified,
      verification_status: item.verification_status || "pending",
      tags: item.tags,
      active: item.active,
      settlement_available: item.settlement_available || false,
      settlement_name: item.settlement_name,
      estimated_payout_min: item.estimated_payout_min,
      estimated_payout_max: item.estimated_payout_max,
      claim_deadline: item.claim_deadline,
      law_firm_partner: item.law_firm_partner,
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
      { name: "Equifax 2017 Data Breach", company: "Equifax", breach_year: 2017, severity: "critical", exposed_fields: "ssn, address, name, dob", data_types: ["ssn","address","name","dob"], records_exposed: 147000000, source_type: "regulator", source_name: "FTC", verified: true, verification_status: "verified", tags: ["credit","identity"], active: true, settlement_available: true, settlement_name: "Equifax Data Breach Settlement", estimated_payout_min: 125, estimated_payout_max: 20000, claim_deadline: "2026-01-22", law_firm_partner: "Kroll Settlement Administration" },
      { name: "T-Mobile 2021 Customer Data Incident", company: "T-Mobile", breach_year: 2021, severity: "critical", exposed_fields: "ssn, phone, address, drivers_license", data_types: ["ssn","phone","address","drivers_license"], records_exposed: 76600000, source_type: "company", source_name: "Company notice", verified: true, verification_status: "verified", tags: ["telecom","identity"], active: true, settlement_available: true, settlement_name: "T-Mobile Data Breach Settlement", estimated_payout_min: 25, estimated_payout_max: 25000, claim_deadline: "2026-07-15", law_firm_partner: "Kroll Settlement Administration" },
      { name: "AT&T 2024 Customer Data Exposure", company: "AT&T", breach_year: 2024, severity: "critical", exposed_fields: "ssn, phone, address, bank_account", data_types: ["ssn","phone","address","bank_account"], records_exposed: 73000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["telecom","financial"], active: true, settlement_available: true, settlement_name: "AT&T Data Breach Class Action", estimated_payout_min: 50, estimated_payout_max: 7500, claim_deadline: "2026-09-30", law_firm_partner: "Morgan & Morgan" },
      { name: "Anthem Health Insurance Breach", company: "Anthem", breach_year: 2015, severity: "critical", exposed_fields: "ssn, dob, medical, address", data_types: ["ssn","dob","medical","address"], records_exposed: 78800000, source_type: "regulator", source_name: "HHS", verified: true, verification_status: "verified", tags: ["healthcare","identity"], active: true, settlement_available: true, settlement_name: "Anthem Data Breach Settlement", estimated_payout_min: 50, estimated_payout_max: 10000, claim_deadline: "2025-06-01", law_firm_partner: "Epiq Systems" },
      { name: "Capital One 2019 Data Breach", company: "Capital One", breach_year: 2019, severity: "critical", exposed_fields: "ssn, bank_account, address, dob", data_types: ["ssn","bank_account","address","dob"], records_exposed: 106000000, source_type: "regulator", source_name: "OCC", verified: true, verification_status: "verified", tags: ["banking","financial"], active: true, settlement_available: true, settlement_name: "Capital One Settlement", estimated_payout_min: 25, estimated_payout_max: 25000, claim_deadline: "2025-09-30", law_firm_partner: "Rust Consulting" },
      { name: "LinkedIn 2012 Credential Exposure", company: "LinkedIn", breach_year: 2012, severity: "high", exposed_fields: "email, password", data_types: ["email","password"], records_exposed: 164000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["social","credentials"], active: true, settlement_available: false },
      { name: "Marriott 2018 Guest Data Incident", company: "Marriott", breach_year: 2018, severity: "high", exposed_fields: "name, passport, email, phone, dob, address", data_types: ["name","passport","email","phone","dob","address"], records_exposed: 500000000, source_type: "company", source_name: "Company notice", verified: true, verification_status: "verified", tags: ["travel","identity"], active: true, settlement_available: true, settlement_name: "Marriott Starwood Settlement", estimated_payout_min: 25, estimated_payout_max: 2500, claim_deadline: "2025-03-01", law_firm_partner: "Epiq Systems" },
      { name: "Yahoo 2013 Account Breach", company: "Yahoo", breach_year: 2013, severity: "high", exposed_fields: "email, password, dob, phone", data_types: ["email","password","dob","phone"], records_exposed: 3000000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["email","credentials"], active: true, settlement_available: true, settlement_name: "Yahoo Data Breach Settlement", estimated_payout_min: 100, estimated_payout_max: 358, claim_deadline: "2024-07-22", law_firm_partner: "Heffler Claims Group" },
      { name: "Adobe 2013 Account Breach", company: "Adobe", breach_year: 2013, severity: "high", exposed_fields: "email, password, username", data_types: ["email","password","username"], records_exposed: 153000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["credentials","software"], active: true, settlement_available: false },
      { name: "Dropbox 2012 Password Exposure", company: "Dropbox", breach_year: 2012, severity: "high", exposed_fields: "email, password", data_types: ["email","password"], records_exposed: 68000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["cloud","credentials"], active: true, settlement_available: false },
      { name: "First American Financial Corp", company: "First American", breach_year: 2019, severity: "critical", exposed_fields: "ssn, bank_account, drivers_license, address", data_types: ["ssn","bank_account","drivers_license","address"], records_exposed: 885000000, source_type: "regulator", source_name: "SEC", verified: true, verification_status: "verified", tags: ["financial","real_estate"], active: true, settlement_available: true, settlement_name: "First American Settlement", estimated_payout_min: 100, estimated_payout_max: 5000, claim_deadline: "2026-04-15", law_firm_partner: "Lieff Cabraser" },
      { name: "University of California Health System", company: "UC Health", breach_year: 2021, severity: "high", exposed_fields: "medical, ssn, dob, address", data_types: ["medical","ssn","dob","address"], records_exposed: 500000, source_type: "company", source_name: "University notice", verified: true, verification_status: "verified", tags: ["healthcare","education"], active: true, settlement_available: true, settlement_name: "UC Health Privacy Settlement", estimated_payout_min: 50, estimated_payout_max: 2000, claim_deadline: "2026-06-01", law_firm_partner: "Girard Sharp" },
      { name: "Twitter 2022 Account Data Incident", company: "Twitter", breach_year: 2022, severity: "medium", exposed_fields: "email, phone", data_types: ["email","phone"], records_exposed: 5400000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["social"], active: true, settlement_available: false },
      { name: "MyFitnessPal 2018 Account Breach", company: "MyFitnessPal", breach_year: 2018, severity: "medium", exposed_fields: "email, password, username", data_types: ["email","password","username"], records_exposed: 150000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["fitness"], active: true, settlement_available: false },
      { name: "Canva 2019 User Data Incident", company: "Canva", breach_year: 2019, severity: "medium", exposed_fields: "email, username", data_types: ["email","username"], records_exposed: 137000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["design"], active: true, settlement_available: false },
      { name: "Home Depot 2014 Payment Card Breach", company: "Home Depot", breach_year: 2014, severity: "high", exposed_fields: "email, credit_card, address", data_types: ["email","credit_card","address"], records_exposed: 56000000, source_type: "court", source_name: "US District Court", verified: true, verification_status: "verified", tags: ["retail","financial"], active: true, settlement_available: true, settlement_name: "Home Depot Data Breach Settlement", estimated_payout_min: 25, estimated_payout_max: 5000, claim_deadline: "2025-01-15", law_firm_partner: "Garden City Group" },
      { name: "Target 2013 Data Breach", company: "Target", breach_year: 2013, severity: "high", exposed_fields: "credit_card, email, address, phone", data_types: ["credit_card","email","address","phone"], records_exposed: 70000000, source_type: "court", source_name: "US District Court", verified: true, verification_status: "verified", tags: ["retail","financial"], active: true, settlement_available: true, settlement_name: "Target Data Breach Settlement", estimated_payout_min: 10, estimated_payout_max: 10000, claim_deadline: "2024-11-30", law_firm_partner: "Rust Consulting" },
      { name: "US Office of Personnel Management", company: "OPM", breach_year: 2015, severity: "critical", exposed_fields: "ssn, fingerprints, dob, address, medical", data_types: ["ssn","fingerprints","dob","address","medical"], records_exposed: 22100000, source_type: "regulator", source_name: "GAO", verified: true, verification_status: "verified", tags: ["government","identity"], active: true, settlement_available: true, settlement_name: "OPM Breach Settlement", estimated_payout_min: 700, estimated_payout_max: 10000, claim_deadline: "2026-12-15", law_firm_partner: "Boies Schiller" },
      { name: "MGM Resorts 2023 Cyber Attack", company: "MGM Resorts", breach_year: 2023, severity: "high", exposed_fields: "ssn, passport, drivers_license, dob", data_types: ["ssn","passport","drivers_license","dob"], records_exposed: 10600000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "pending", tags: ["hospitality","identity"], active: true, settlement_available: false },
      { name: "23andMe 2023 Genetic Data Breach", company: "23andMe", breach_year: 2023, severity: "critical", exposed_fields: "dob, name, genetic_data, email", data_types: ["dob","name","genetic_data","email"], records_exposed: 6900000, source_type: "company", source_name: "Company SEC filing", verified: true, verification_status: "verified", tags: ["healthcare","genetic"], active: true, settlement_available: true, settlement_name: "23andMe Genetic Privacy Settlement", estimated_payout_min: 100, estimated_payout_max: 10000, claim_deadline: "2026-08-01", law_firm_partner: "Lieff Cabraser" },
      { name: "MOVEit Transfer Exploit 2023", company: "Progress Software", breach_year: 2023, severity: "high", exposed_fields: "ssn, financial, address", data_types: ["ssn","financial","address"], records_exposed: 62000000, source_type: "press", source_name: "Public reporting", verified: true, verification_status: "verified", tags: ["software","supply_chain"], active: true, settlement_available: false },
      { name: "Rite Aid 2023 Customer Data Incident", company: "Rite Aid", breach_year: 2023, severity: "medium", exposed_fields: "name, address, dob, drivers_license", data_types: ["name","address","dob","drivers_license"], records_exposed: 2200000, source_type: "company", source_name: "Company notice", verified: true, verification_status: "pending", tags: ["retail","pharmacy"], active: true, settlement_available: false },
      { name: "Change Healthcare 2024 Breach", company: "Change Healthcare", breach_year: 2024, severity: "critical", exposed_fields: "ssn, medical, insurance, bank_account", data_types: ["ssn","medical","insurance","bank_account"], records_exposed: 100000000, source_type: "regulator", source_name: "HHS", verified: true, verification_status: "verified", tags: ["healthcare","insurance"], active: true, settlement_available: true, settlement_name: "Change Healthcare Settlement", estimated_payout_min: 75, estimated_payout_max: 15000, claim_deadline: "2027-01-15", law_firm_partner: "Hagens Berman" },
      { name: "National Public Data 2024 Breach", company: "National Public Data", breach_year: 2024, severity: "critical", exposed_fields: "ssn, address, name, dob, phone", data_types: ["ssn","address","name","dob","phone"], records_exposed: 2700000000, source_type: "press", source_name: "Security researchers", verified: true, verification_status: "disputed", tags: ["data_broker","identity"], active: true, settlement_available: false },
      { name: "Ascension Health 2024 Cyber Attack", company: "Ascension", breach_year: 2024, severity: "high", exposed_fields: "medical, ssn, insurance", data_types: ["medical","ssn","insurance"], records_exposed: 5600000, source_type: "company", source_name: "Company notice", verified: true, verification_status: "pending", tags: ["healthcare"], active: true, settlement_available: false },
    ];

    const { error } = await supabase.from("breach_catalog").insert(seedData as any);
    if (error) {
      if (error.message.includes("duplicate")) toast.info("Catalog already has data");
      else toast.error("Seed failed: " + error.message);
    } else {
      toast.success("25 demo breaches seeded!");
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
        <Select value={filterSettlement} onValueChange={setFilterSettlement}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue placeholder="Settlement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Has Settlement</SelectItem>
            <SelectItem value="no">No Settlement</SelectItem>
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
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
                  <td className="px-4 py-3">
                    {item.settlement_available ? (
                      <div>
                        <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px]">Settlement</Badge>
                        {item.estimated_payout_min != null && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">${item.estimated_payout_min}–${item.estimated_payout_max}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Exposed Fields *</Label>
                <Input className="rounded-xl" value={form.exposed_fields} onChange={(e) => setForm({ ...form, exposed_fields: e.target.value })} placeholder="e.g. ssn, address, name, dob" />
              </div>
              <div className="grid gap-1.5">
                <Label>Records Exposed</Label>
                <Input className="rounded-xl" type="number" value={form.records_exposed ?? ""} onChange={(e) => setForm({ ...form, records_exposed: e.target.value ? parseInt(e.target.value) : null })} placeholder="e.g. 147000000" />
              </div>
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

            {/* Settlement Section */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Switch checked={form.settlement_available} onCheckedChange={(v) => setForm({ ...form, settlement_available: v })} />
                <Label className="font-medium">Settlement Available</Label>
              </div>
              {form.settlement_available && (
                <div className="grid gap-4 pl-2 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label>Settlement Name</Label>
                    <Input className="rounded-xl" value={form.settlement_name ?? ""} onChange={(e) => setForm({ ...form, settlement_name: e.target.value || null })} placeholder="e.g. Equifax Data Breach Settlement" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label>Est. Payout Min ($)</Label>
                      <Input className="rounded-xl" type="number" value={form.estimated_payout_min ?? ""} onChange={(e) => setForm({ ...form, estimated_payout_min: e.target.value ? parseFloat(e.target.value) : null })} placeholder="25" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Est. Payout Max ($)</Label>
                      <Input className="rounded-xl" type="number" value={form.estimated_payout_max ?? ""} onChange={(e) => setForm({ ...form, estimated_payout_max: e.target.value ? parseFloat(e.target.value) : null })} placeholder="25000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label>Claim Deadline</Label>
                      <Input className="rounded-xl" type="date" value={form.claim_deadline ?? ""} onChange={(e) => setForm({ ...form, claim_deadline: e.target.value || null })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Law Firm Partner</Label>
                      <Input className="rounded-xl" value={form.law_firm_partner ?? ""} onChange={(e) => setForm({ ...form, law_firm_partner: e.target.value || null })} placeholder="e.g. Kroll" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.verified} onCheckedChange={(v) => setForm({ ...form, verified: v, verification_status: v ? "verified" : "pending" })} />
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
