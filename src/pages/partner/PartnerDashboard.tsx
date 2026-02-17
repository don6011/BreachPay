import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Clock, CheckCircle, XCircle, ListTodo, Loader2, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface DeadlineItem {
  settlement_name: string;
  deadline: string;
  days_left: number;
  claim_count: number;
}

interface ActivityItem {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  updated_by: string | null;
  claim_id: string;
}

const PartnerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, submitted: 0, under_review: 0, documentation_required: 0, approved: 0, rejected: 0, paid: 0, open_tasks: 0 });
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [claimsRes, tasksRes] = await Promise.all([
          supabase
            .from("claims")
            .select("id, status, settlement_id, settlements(name, deadline)")
            .eq("partner_id", user.id),
          supabase
            .from("claim_tasks")
            .select("id, status, claim_id")
            .eq("status", "open"),
        ]);

        const claims = claimsRes.data || [];
        const claimIds = claims.map((c: any) => c.id);

        // Count tasks for partner's claims only
        const openTasks = (tasksRes.data || []).filter((t: any) => claimIds.includes(t.claim_id)).length;

        const c = { total: claims.length, submitted: 0, under_review: 0, documentation_required: 0, approved: 0, rejected: 0, paid: 0, open_tasks: openTasks };
        claims.forEach((cl: any) => {
          if (cl.status in c) (c as any)[cl.status]++;
        });
        setCounts(c);

        // Deadlines
        const deadlineMap: Record<string, DeadlineItem> = {};
        claims.forEach((cl: any) => {
          const s = cl.settlements;
          if (!s?.deadline) return;
          const daysLeft = differenceInDays(new Date(s.deadline), new Date());
          if (daysLeft < 0) return;
          if (!deadlineMap[cl.settlement_id]) {
            deadlineMap[cl.settlement_id] = { settlement_name: s.name, deadline: s.deadline, days_left: daysLeft, claim_count: 0 };
          }
          deadlineMap[cl.settlement_id].claim_count++;
        });
        setDeadlines(Object.values(deadlineMap).sort((a, b) => a.days_left - b.days_left).slice(0, 5));

        // Activity feed
        if (claimIds.length > 0) {
          const { data: historyData } = await supabase
            .from("claim_status_history")
            .select("id, status, note, created_at, updated_by, claim_id")
            .in("claim_id", claimIds)
            .order("created_at", { ascending: false })
            .limit(10);
          setActivity((historyData as ActivityItem[]) || []);
        }
      } catch (error) {
        console.error("Error fetching partner dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Case Management" subtitle="Overview of assigned cases, tasks, and upcoming deadlines" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8">
        <StatCard icon={FileText} label="Total Assigned" value={counts.total} variant="teal" />
        <StatCard icon={ListTodo} label="Open Tasks" value={counts.open_tasks} />
        <StatCard icon={AlertTriangle} label="Docs Required" value={counts.documentation_required} />
        <StatCard icon={Clock} label="Under Review" value={counts.under_review} />
        <StatCard icon={CheckCircle} label="Approved" value={counts.approved} variant="teal" />
        <StatCard icon={XCircle} label="Rejected" value={counts.rejected} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Upcoming Deadlines</h2>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deadline</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Days Left</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cases</th>
                </tr>
              </thead>
              <tbody>
                {deadlines.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No upcoming deadlines</td></tr>
                ) : (
                  deadlines.map((d, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{d.settlement_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(d.deadline), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${d.days_left <= 7 ? "text-destructive" : d.days_left <= 30 ? "text-warning" : "text-success"}`}>
                          {d.days_left}d
                        </span>
                      </td>
                      <td className="px-4 py-3">{d.claim_count}</td>
                    </tr>
                  ))
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
                  <StatusPill variant={a.status as any} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      Case {a.claim_id.slice(0, 8)}… — {a.note || `Status changed to ${a.status}`}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60">
                      {format(new Date(a.created_at), "MMM d, h:mm a")}
                      {a.updated_by && ` · ${a.updated_by}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
