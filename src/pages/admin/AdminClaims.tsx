import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { mockClaims } from "@/data/mockData";
import { Download, Flag } from "lucide-react";

const AdminClaims = () => {
  return (
    <div>
      <PageHeader title="Claims Management" subtitle="Review and manage filed claims">
        <Button size="sm" variant="outline"><Download className="mr-1 h-3 w-3" />Export CSV</Button>
        <Button size="sm" variant="outline"><Flag className="mr-1 h-3 w-3" />Flag Suspicious</Button>
      </PageHeader>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
            </tr>
          </thead>
          <tbody>
            {mockClaims.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                <td className="px-4 py-3 font-medium">{c.settlement_name}</td>
                <td className="px-4 py-3"><StatusPill variant={c.status} /></td>
                <td className="px-4 py-3 text-primary">${c.estimated_payout}</td>
                <td className="px-4 py-3">{c.filed_at}</td>
                <td className="px-4 py-3">{c.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminClaims;
