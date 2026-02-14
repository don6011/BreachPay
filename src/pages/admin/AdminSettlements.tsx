import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Send, Zap, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
}

const AdminSettlements = () => {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [rebuildingMatches, setRebuildingMatches] = useState(false);
  const [runningScan, setRunningScan] = useState(false);

  // Add settlement form state
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newStatus, setNewStatus] = useState("open");
  const [newPayoutMin, setNewPayoutMin] = useState("");
  const [newPayoutMax, setNewPayoutMax] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [addingSettlement, setAddingSettlement] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchSettlements = async () => {
    const { data } = await supabase
      .from("settlements")
      .select("id, name, company, breach_year, status, payout_min, payout_max, deadline, description")
      .order("created_at", { ascending: false });
    if (data) setSettlements(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchSettlements();
  }, [user]);

  const handleAddSettlement = async () => {
    if (!newName || !newCompany) return;
    setAddingSettlement(true);
    try {
      const { error } = await supabase.from("settlements").insert({
        name: newName,
        company: newCompany,
        breach_year: newYear ? parseInt(newYear) : null,
        status: newStatus as any,
        payout_min: newPayoutMin ? parseFloat(newPayoutMin) : null,
        payout_max: newPayoutMax ? parseFloat(newPayoutMax) : null,
        deadline: newDeadline || null,
        description: newDescription || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Success", description: "Settlement added" });
      setDialogOpen(false);
      setNewName(""); setNewCompany(""); setNewYear(""); setNewPayoutMin(""); setNewPayoutMax(""); setNewDeadline(""); setNewDescription("");
      fetchSettlements();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add settlement", variant: "destructive" });
    } finally {
      setAddingSettlement(false);
    }
  };

  const callEdgeFunction = async (
    functionName: string,
    loadingState: [boolean, (v: boolean) => void]
  ) => {
    const [, setLoadingState] = loadingState;
    setLoadingState(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
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

      if (data.message && !data.success && !data.created && !data.alerts_sent && !data.scans_initiated) {
        title = "Info";
      }

      toast({ title, description });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to trigger ${functionName}: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setLoadingState(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settlement Management" subtitle="Manage settlement records">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl"><Plus className="mr-1 h-3 w-3" />Add Settlement</Button>
          </DialogTrigger>
          <DialogContent className="bg-card rounded-2xl">
            <DialogHeader><DialogTitle>Add Settlement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Settlement Name" className="rounded-xl" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Company" className="rounded-xl" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Breach Year" type="number" className="rounded-xl" value={newYear} onChange={(e) => setNewYear(e.target.value)} />
                <Input placeholder="Status (open/pending/closed)" className="rounded-xl" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Payout Min ($)" type="number" className="rounded-xl" value={newPayoutMin} onChange={(e) => setNewPayoutMin(e.target.value)} />
                <Input placeholder="Payout Max ($)" type="number" className="rounded-xl" value={newPayoutMax} onChange={(e) => setNewPayoutMax(e.target.value)} />
              </div>
              <Input placeholder="Deadline" type="date" className="rounded-xl" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              <Input placeholder="Description" className="rounded-xl" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              <Button className="w-full rounded-xl bg-primary text-primary-foreground" onClick={handleAddSettlement} disabled={addingSettlement || !newName || !newCompany}>
                {addingSettlement ? "Adding..." : "Add Settlement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : settlements.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No settlements yet</td></tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.company}</td>
                  <td className="px-4 py-3">{s.breach_year || "—"}</td>
                  <td className="px-4 py-3 text-primary">${s.payout_min || 0}–${(s.payout_max || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{s.deadline || "—"}</td>
                  <td className="px-4 py-3"><StatusPill variant={s.status as any} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSettlements;
