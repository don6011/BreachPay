import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Clock, CheckCircle, XCircle, ListTodo, Loader2, AlertTriangle, DollarSign } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface DeadlineItem {
  settlement_name: string;
  deadline: string;
  days_left: number;
  claim_count: number;
}

interface ActivityItem {
  id: string;
  action: string;
  meta: any;
  created_at: string;
  claim_id: string | null;
}

const PartnerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partnerOrg, setPartnerOrg] = useState<{ id: string; name: string; partner_type: string } | null>(null);
  const [counts, setCounts] = useState({ total: 0, assigned: 0, in_progress: 0, completed: 0, submitted: 0, under_review: 0, approved: 0, rejected: 0, paid: 0 });
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Get partner org
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id, partners(id, name, partner_type)")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!pu) { setLoading(false); return; }

        const partner = (pu as any).partners;
        setPartnerOrg({ id: partner.id, name: partner.name, partner_type: partner.partner_type });

        // Get claim assignments for this partner org
        const { data: assignments } = await supabase
          .from("claim_assignments")
          .select("claim_id, assignment_status, claims(id, status, est_payout, settlement_id, settlements(name, deadline, company))")
          .eq("partner_id", partner.id);

        const claims = (assignments || []).map((a: any) => ({ ...a.claims, assignment_status: a.assignment_status }));

        const c = { total: claims.length, assigned: 0, in_progress: 0, completed: 0, submitted: 0, under_review: 0, approved: 0, rejected: 0, paid: 0 };
        claims.forEach((cl: any) => {
          if (cl.assignment_status in c) (c as any)[cl.assignment_status]++;
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

        // Activity feed from partner_activity_log
        const { data: activityData } = await supabase
          .from("partner_activity_log")
          .select("id, action, meta, created_at, claim_id")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false })
          .limit(10);

        setActivity((activityData as ActivityItem[]) || []);
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
      <PageHeader
        title="Case Management"
        subtitle={partnerOrg ? `${partnerOrg.name} · ${partnerOrg.partner_type === "law_firm" ? "Law Firm" : "Claims Administrator"}` : "Overview of assigned cases"}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8">
        <StatCard icon={FileText} label="Total Assigned" value={counts.total} variant="teal" />
        <StatCard icon={Clock} label="In Progress" value={counts.in_progress} />
        <StatCard icon={AlertTriangle} label="Under Review" value={counts.under_review} />
        <StatCard icon={CheckCircle} label="Approved" value={counts.approved} variant="teal" />
        <StatCard icon={XCircle} label="Rejected" value={counts.rejected} />
        <StatCard icon={DollarSign} label="Paid" value={counts.paid} />
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
    </div>
  );
};

export default PartnerDashboard;
