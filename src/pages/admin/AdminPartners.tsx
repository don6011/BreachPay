import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, FileText, DollarSign, Search, Building2, Plus, Pencil, Link2, Unlink,
  Trash2, Eye, ArrowLeft, CheckCircle, Clock, XCircle, UserPlus,
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
interface PartnerOrg {
  id: string;
  name: string;
  partner_type: string;
  website: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
  assignment_count: number;
}

interface PartnerUserRow {
  id: string;
  user_id: string;
  email: string;
  partner_id: string;
  partner_name: string;
  role: string;
  created_at: string;
}

const AdminPartners = () => {
  const { user } = useAuth();

  const [orgs, setOrgs] = useState<PartnerOrg[]>([]);
  const [users, setUsers] = useState<PartnerUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [orgSearch, setOrgSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Org dialog
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PartnerOrg | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", partner_type: "law_firm", contact_email: "", website: "" });

  // Delete confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<PartnerOrg | null>(null);

  // Detail view
  const [detailOrg, setDetailOrg] = useState<PartnerOrg | null>(null);

  // Add user dialog
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ email: "", role: "agent", partner_id: "" });

  /* ────────── Fetch Orgs ────────── */
  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const [orgsRes, usersRes, assignmentsRes] = await Promise.all([
        supabase.from("partners").select("*").order("created_at", { ascending: false }),
        supabase.from("partner_users").select("partner_id"),
        supabase.from("claim_assignments").select("partner_id"),
      ]);

      const userCountMap: Record<string, number> = {};
      (usersRes.data || []).forEach((u: any) => { userCountMap[u.partner_id] = (userCountMap[u.partner_id] || 0) + 1; });

      const assignCountMap: Record<string, number> = {};
      (assignmentsRes.data || []).forEach((a: any) => { assignCountMap[a.partner_id] = (assignCountMap[a.partner_id] || 0) + 1; });

      setOrgs((orgsRes.data || []).map((o: any) => ({
        ...o,
        user_count: userCountMap[o.id] || 0,
        assignment_count: assignCountMap[o.id] || 0,
      })));
    } catch (err) {
      console.error("Error fetching partners:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ────────── Fetch Users ────────── */
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data: puData } = await supabase
        .from("partner_users")
        .select("id, user_id, partner_id, role, created_at, partners(name)")
        .order("created_at", { ascending: false });

      if (!puData) { setUsersLoading(false); return; }

      const userIds = [...new Set(puData.map((p: any) => p.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("user_profiles").select("user_id, email").in("user_id", userIds)
        : { data: [] };

      const emailMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { emailMap[p.user_id] = p.email || "—"; });

      setUsers(puData.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        email: emailMap[p.user_id] || "—",
        partner_id: p.partner_id,
        partner_name: (p as any).partners?.name || "Unknown",
        role: p.role,
        created_at: p.created_at,
      })));
    } catch (err) {
      console.error("Error fetching partner users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { fetchOrgs(); fetchUsers(); }, [user]);

  /* ────────── Org CRUD ────────── */
  const openCreateOrg = () => {
    setEditingOrg(null);
    setOrgForm({ name: "", partner_type: "law_firm", contact_email: "", website: "" });
    setOrgDialogOpen(true);
  };

  const openEditOrg = (org: PartnerOrg) => {
    setEditingOrg(org);
    setOrgForm({ name: org.name, partner_type: org.partner_type, contact_email: org.contact_email || "", website: org.website || "" });
    setOrgDialogOpen(true);
  };

  const saveOrg = async () => {
    if (!orgForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }

    const payload = {
      name: orgForm.name.trim(),
      partner_type: orgForm.partner_type,
      contact_email: orgForm.contact_email.trim() || null,
      website: orgForm.website.trim() || null,
    };

    if (editingOrg) {
      const { error } = await supabase.from("partners").update(payload).eq("id", editingOrg.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Partner updated" });
    } else {
      const { error } = await supabase.from("partners").insert(payload);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Partner created" });
    }

    setOrgDialogOpen(false);
    fetchOrgs();
  };

  const confirmDeleteOrg = (org: PartnerOrg) => { setDeletingOrg(org); setDeleteDialogOpen(true); };

  const deleteOrg = async () => {
    if (!deletingOrg) return;
    const { error } = await supabase.from("partners").delete().eq("id", deletingOrg.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Partner deleted" });
      if (detailOrg?.id === deletingOrg.id) setDetailOrg(null);
    }
    setDeleteDialogOpen(false);
    setDeletingOrg(null);
    fetchOrgs();
    fetchUsers();
  };

  /* ────────── Add User ────────── */
  const openAddUser = (partnerId?: string) => {
    setAddUserForm({ email: "", role: "agent", partner_id: partnerId || "" });
    setAddUserOpen(true);
  };

  const saveUser = async () => {
    if (!addUserForm.email.trim() || !addUserForm.partner_id) {
      toast({ title: "Email and partner org are required", variant: "destructive" });
      return;
    }

    // Look up user by email
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("email", addUserForm.email.trim())
      .maybeSingle();

    if (!profile) {
      toast({ title: "User not found", description: "No account with that email exists", variant: "destructive" });
      return;
    }

    // Add to partner_users
    const { error } = await supabase.from("partner_users").insert({
      partner_id: addUserForm.partner_id,
      user_id: profile.user_id,
      role: addUserForm.role,
    });

    if (error) {
      toast({ title: "Failed to add user", description: error.message, variant: "destructive" });
      return;
    }

    // Ensure they have the partner role in user_roles
    await supabase.from("user_roles").upsert(
      { user_id: profile.user_id, role: "partner" },
      { onConflict: "user_id,role" }
    );

    toast({ title: "User added to partner organization" });
    setAddUserOpen(false);
    fetchUsers();
    fetchOrgs();
  };

  const removeUser = async (puId: string) => {
    const { error } = await supabase.from("partner_users").delete().eq("id", puId);
    if (error) { toast({ title: "Failed to remove user", variant: "destructive" }); return; }
    toast({ title: "User removed" });
    fetchUsers();
    fetchOrgs();
  };

  /* ────────── Derived ────────── */
  const filteredOrgs = orgs.filter((o) => o.name.toLowerCase().includes(orgSearch.toLowerCase()));
  const filteredUsers = users.filter((u) => u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.partner_name.toLowerCase().includes(userSearch.toLowerCase()));

  const totals = orgs.reduce(
    (acc, o) => ({ orgs: acc.orgs + 1, users: acc.users + o.user_count, assignments: acc.assignments + o.assignment_count }),
    { orgs: 0, users: 0, assignments: 0 }
  );

  /* ── Detail view ── */
  const detailUsers = detailOrg ? users.filter((u) => u.partner_id === detailOrg.id) : [];

  if (detailOrg) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="ghost" className="gap-2 mb-2" onClick={() => setDetailOrg(null)}>
            <ArrowLeft className="h-4 w-4" /> Back to Partners
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{detailOrg.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${detailOrg.is_active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {detailOrg.is_active ? "active" : "inactive"}
                </span>
                <span className="capitalize">{detailOrg.partner_type.replace("_", " ")}</span>
                {detailOrg.contact_email && <span>{detailOrg.contact_email}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => openAddUser(detailOrg.id)}>
                <UserPlus className="h-3.5 w-3.5" /> Add User
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditOrg(detailOrg)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => confirmDeleteOrg(detailOrg)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Users className="h-3.5 w-3.5" /> Users</div>
            <p className="text-2xl font-bold">{detailUsers.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><FileText className="h-3.5 w-3.5" /> Assignments</div>
            <p className="text-2xl font-bold">{detailOrg.assignment_count}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-3">Organization Users</h2>
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {detailUsers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No users in this organization</td></tr>
              ) : (
                detailUsers.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3 capitalize">{u.role}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => removeUser(u.id)} className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {renderDialogs()}
      </div>
    );
  }

  function renderDialogs() {
    return (
      <>
        {/* Org Dialog */}
        <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingOrg ? "Edit Partner" : "Create Partner Organization"}</DialogTitle>
              <DialogDescription>{editingOrg ? "Update the partner's information." : "Create a new law firm or claims administrator."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Organization Name *</Label>
                <Input value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Law Group" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={orgForm.partner_type} onValueChange={(v) => setOrgForm((f) => ({ ...f, partner_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="law_firm">Law Firm</SelectItem>
                    <SelectItem value="claims_admin">Claims Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input value={orgForm.contact_email} onChange={(e) => setOrgForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="contact@firm.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={orgForm.website} onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://firm.com" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOrgDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveOrg}>{editingOrg ? "Save Changes" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Partner Organization</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-semibold">{deletingOrg?.name}</span>?
                This will remove all associated users and assignments. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add User Dialog */}
        <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add User to Organization</DialogTitle>
              <DialogDescription>Enter the email of an existing BreachPay user to add them as a partner.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>User Email *</Label>
                <Input value={addUserForm.email} onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))} placeholder="user@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={addUserForm.role} onValueChange={(v) => setAddUserForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!addUserForm.partner_id && (
                <div className="space-y-1.5">
                  <Label>Organization</Label>
                  <Select value={addUserForm.partner_id} onValueChange={(v) => setAddUserForm((f) => ({ ...f, partner_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select org…" /></SelectTrigger>
                    <SelectContent>
                      {orgs.filter(o => o.is_active).map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
              <Button onClick={saveUser}>Add User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  /* ────────── Main Render ────────── */
  return (
    <div>
      <PageHeader title="Partner Management" subtitle="Manage partner organizations, users, and claim assignments" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Building2} label="Partner Orgs" value={totals.orgs} variant="teal" />
        <StatCard icon={Users} label="Partner Users" value={totals.users} />
        <StatCard icon={FileText} label="Claim Assignments" value={totals.assignments} />
      </div>

      <Tabs defaultValue="orgs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orgs">Organizations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* ═══ Orgs Tab ═══ */}
        <TabsContent value="orgs" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search organizations..." className="pl-9 rounded-xl" value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} />
            </div>
            <Button onClick={openCreateOrg} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> New Partner
            </Button>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Users</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assignments</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredOrgs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No organizations found</td></tr>
                ) : (
                  filteredOrgs.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => setDetailOrg(o)} className="text-primary hover:underline font-medium text-left">{o.name}</button>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{o.partner_type.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${o.is_active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {o.is_active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{o.user_count}</td>
                      <td className="px-4 py-3">{o.assignment_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailOrg(o)} className="gap-1"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditOrg(o)} className="gap-1"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => confirmDeleteOrg(o)} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9 rounded-xl" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <Button onClick={() => openAddUser()} className="rounded-xl gap-2">
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organization</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{u.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.partner_name}</td>
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => removeUser(u.id)} className="gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {renderDialogs()}
    </div>
  );
};

export default AdminPartners;
