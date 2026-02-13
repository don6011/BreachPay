import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockSettlements } from "@/data/mockData";
import { Plus, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Settlement } from "@/types";

const AdminSettlements = () => {
  const [settlements] = useState<Settlement[]>(mockSettlements);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const handleSendDeadlineAlerts = async () => {
    setSendingAlerts(true);
    try {
      const response = await fetch('/functions/v1/run-deadline-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: `Sent ${data.alerts_sent} deadline alerts` });
      } else {
        toast({ title: "Error", description: data.error || "Failed to send alerts", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    } finally {
      setSendingAlerts(false);
    }
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
       <Button size="sm" variant="outline" className="rounded-xl" onClick={handleSendDeadlineAlerts} disabled={sendingAlerts}><Send className="mr-1 h-3 w-3" />{sendingAlerts ? "Sending..." : "Send Deadline Alerts"}</Button>
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
