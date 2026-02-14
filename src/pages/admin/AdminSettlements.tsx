import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockSettlements } from "@/data/mockData";
import { Plus, Send, Zap, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Settlement } from "@/types";

const AdminSettlements = () => {
  const [settlements] = useState<Settlement[]>(mockSettlements);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [rebuildingMatches, setRebuildingMatches] = useState(false);
  const [runningScan, setRunningScan] = useState(false);

  const callEdgeFunction = async (
    functionName: string,
    loadingState: [boolean, (v: boolean) => void]
  ) => {
    const [, setLoading] = loadingState;
    setLoading(true);
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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

      toast({
        title,
        description,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to trigger ${functionName}: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
      console.error(`Failed to call ${functionName}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendDeadlineAlerts = () => {
    callEdgeFunction("run-deadline-alerts", [sendingAlerts, setSendingAlerts]);
  };

  const handleRebuildMatches = () => {
    callEdgeFunction("rebuild-settlement-matches", [rebuildingMatches, setRebuildingMatches]);
  };

  const handleRunScans = () => {
    callEdgeFunction("run-scheduled-scans", [runningScan, setRunningScan]);
  };

  return (
    <div>
      <PageHeader title="Settlement Management" subtitle="Manage settlement records">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl"><Plus className="mr-1 h-3 w-3" />Add Settlement</Button>
          </DialogTrigger>
          <DialogContent className="bg-card rounded-2xl">
           <DialogHeader><DialogTitle>Add Settlement</DialogTitle></DialogHeader>
           <div className="space-y-3">
             <Input placeholder="Settlement Name" className="rounded-xl" />
             <Input placeholder="Company" className="rounded-xl" />
             <div className="grid grid-cols-2 gap-3">
               <Input placeholder="Breach Year" type="number" className="rounded-xl" />
               <Input placeholder="Status" className="rounded-xl" />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <Input placeholder="Payout Min ($)" type="number" className="rounded-xl" />
               <Input placeholder="Payout Max ($)" type="number" className="rounded-xl" />
             </div>
             <Input placeholder="Deadline" type="date" className="rounded-xl" />
             <Input placeholder="Description" className="rounded-xl" />
             <Button className="w-full rounded-xl bg-primary text-primary-foreground">Add Settlement</Button>
           </div>
       </DialogContent>
        </Dialog>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handleSendDeadlineAlerts} disabled={sendingAlerts}><Send className="mr-1 h-3 w-3" />{sendingAlerts ? "Sending..." : "Send Alerts"}</Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRebuildMatches} disabled={rebuildingMatches}><RefreshCw className="mr-1 h-3 w-3" />{rebuildingMatches ? "Rebuilding..." : "Rebuild Matches"}</Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRunScans} disabled={runningScan}><Zap className="mr-1 h-3 w-3" />{runningScan ? "Scanning..." : "Run Scans"}</Button>
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
            {settlements.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.company}</td>
                <td className="px-4 py-3">{s.breach_year}</td>
                <td className="px-4 py-3 text-primary">${s.payout_min}–${s.payout_max.toLocaleString()}</td>
                <td className="px-4 py-3">{s.deadline}</td>
                <td className="px-4 py-3"><StatusPill variant={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSettlements;
