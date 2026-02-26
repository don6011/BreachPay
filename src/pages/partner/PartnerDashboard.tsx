import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Clock, CheckCircle, XCircle, DollarSign, Loader2, AlertTriangle, Search, ListTodo } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface WorkQueueItem {
  id: string;
  settlement_name: string;
  settlement_company: string;
  status: string;
  assignment_status: string;
  est_payout: number | null;
  filed_at: string | null;
  updated_at: string;
  deadline: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  meta: any;
  created_at: string;
  claim_id: string | null;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documentation_required", label: "Docs Required" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

const PartnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [partnerOrg, setPartnerOrg] = useState<{ id: string; name: string; partner_type: string } | null>(null);
  const [counts, setCounts] = useState({ total: 0, in_progress: 0, completed: 0, approved: 0, paid: 0 });
  const [queue, setQueue] = useState<WorkQueueItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [settlementFilter, setSettlementFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [settlements, setSettlements] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id, partners(id, name, partner_type)")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!pu) { setLoading(false); return; }

        const partner = (pu as any).partners;
        setPartnerOrg({ id: partner.id, name: partner.name, partner_type: partner.partner_type });

        const [assignmentsRes, activityRes] = await Promise.all([
          supabase
            .from("claim_assignments")
            .select("assignment_status, claims(id, status, est_payout, filed_at, updated_at, settlements(name, company, deadline))")
            .eq("partner_id", partner.id)
            .order("assigned_at", { ascending: false }),
          supabase
            .from("partner_activity_log")
            .select("id, action, meta, created_at, claim_id")
            .eq("partner_id", partner.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const items: WorkQueueItem[] = (assignmentsRes.data || [])
          .filter((a: any) => a.claims)
          .map((a: any) => ({
            id: a.claims.id,
            settlement_name: a.claims.settlements?.name || "Unknown",
            settlement_company: a.claims.settlements?.company || "",
            status: a.claims.status,
            assignment_status: a.assignment_status,
            est_payout: a.claims.est_payout ? Number(a.claims.est_payout) : null,
            filed_at: a.claims.filed_at,
            updated_at: a.claims.updated_at,
            deadline: a.claims.settlements?.deadline || null,
          }));

        setQueue(items);
        setSettlements([...new Set(items.map(i => i.settlement_name))].sort());

        const c = { total: items.length, in_progress: 0, completed: 0, approved: 0, paid: 0 };
        items.forEach((it) => {
          if (it.assignment_status === "in_progress") c.in_progress++;
          if (it.assignment_status === "completed") c.completed++;
          if (it.status === "approved") c.approved++;
          if (it.status === "paid") c.paid++;
        });
        setCounts(c);
        setActivity((activityRes.data as ActivityItem[]) || []);
      } catch (error) {
        console.error("Error fetching partner dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filtered = queue.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (settlementFilter !== "all" && item.settlement_name !== settlementFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.id.toLowerCase().includes(q) && !item.settlement_name.toLowerCase().includes(q) && !item.settlement_company.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Partner Dashboard"
        subtitle={partnerOrg ? `${partnerOrg.name} · ${partnerOrg.partner_type === "law_firm" ? "Law Firm" : "Claims Administrator"}` : "Overview"}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-8">
        <StatCard icon={FileText} label="Assigned" value={counts.total} variant="teal" />
        <StatCard icon={Clock} label="In Progress" value={counts.in_progress} />
        <StatCard icon={CheckCircle} label="Completed" value={counts.completed} />
        <StatCard icon={AlertTriangle} label="Approved" value={counts.approved} variant="teal" />
        <StatCard icon={DollarSign} label="Paid" value={counts.paid} />
      </div>

      {/* Work Queue */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" /> Work Queue
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-56 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={settlementFilter} onValueChange={setSettlementFilter}>
            <SelectTrigger className="w-52 rounded-xl">
              <SelectValue placeholder="Settlement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Settlements</SelectItem>
              {settlements.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Case ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claim Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assignment</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deadline</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Est. Payout</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No cases match your filters</td></tr>
              ) : (
                filtered.map((item) => {
                  const daysLeft = item.deadline ? differenceInDays(new Date(item.deadline), new Date()) : null;
                  return (
                    <tr
                      key={item.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/partner/claims/${item.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{item.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.settlement_company}</div>
                        <div className="text-xs text-muted-foreground">{item.settlement_name}</div>
                      </td>
                      <td className="px-4 py-3"><StatusPill variant={item.status as any} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.assignment_status === "completed" ? "bg-success/10 text-success" :
                          item.assignment_status === "in_progress" ? "bg-primary/10 text-primary" :
                          item.assignment_status === "rejected" ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {item.assignment_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {daysLeft !== null ? (
                          <span className={`font-semibold ${daysLeft <= 7 ? "text-destructive" : daysLeft <= 30 ? "text-warning" : "text-muted-foreground"}`}>
                            {daysLeft}d left
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-primary font-semibold">{item.est_payout ? `$${item.est_payout.toLocaleString()}` : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border">
          {activity.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground">No recent activity</p>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.claim_id ? `Case ${a.claim_id.slice(0, 8)}…` : ""}
                    {a.meta?.notes ? ` — ${a.meta.notes}` : ""}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60">
                    {format(new Date(a.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
