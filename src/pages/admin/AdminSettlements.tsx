import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockSettlements } from "@/data/mockData";
import { Plus, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Settlement } from "@/types";

const AdminSettlements = () => {
  const [settlements] = useState<Settlement[]>(mockSettlements);

  return (
    <div>
      <PageHeader title="Settlement Management" subtitle="Manage settlement records">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add Settlement</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Add Settlement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Settlement Name" />
              <Input placeholder="Company" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Breach Year" type="number" />
                <Input placeholder="Status" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Payout Min ($)" type="number" />
                <Input placeholder="Payout Max ($)" type="number" />
              </div>
              <Input placeholder="Deadline" type="date" />
              <Input placeholder="Description" />
              <Button className="w-full">Add Settlement</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button size="sm" variant="outline"><Send className="mr-1 h-3 w-3" />Send Deadline Alerts</Button>
      </PageHeader>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
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
              <tr key={s.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
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
