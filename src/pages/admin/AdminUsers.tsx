import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockAdminUsers } from "@/data/mockData";
import { Download, Search } from "lucide-react";
import { useState } from "react";

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const filtered = mockAdminUsers.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage registered users">
        <Button variant="outline" size="sm" className="rounded-xl"><Download className="mr-1 h-3 w-3" />Export CSV</Button>
      </PageHeader>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Breaches</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matches</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claims</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Est. Value</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{user.email}</td>
                <td className="px-4 py-3">{user.breaches}</td>
                <td className="px-4 py-3">{user.matches}</td>
                <td className="px-4 py-3">{user.claims}</td>
                <td className="px-4 py-3 text-primary">${user.estimated_value}</td>
                <td className="px-4 py-3"><StatusPill variant={user.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
