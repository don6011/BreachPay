import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, FileText, ListTodo, AlertTriangle } from "lucide-react";
import type { ClaimStatus } from "@/types";

interface PartnerClaimRow {
  id: string;
  settlement_name: string;
  settlement_company: string;
  user_email_masked: string;
  status: ClaimStatus;
  est_payout: number | null;
  filed_at: string | null;
  updated_at: string;
  doc_count: number;
  open_tasks: number;
}

const statusOptions = ["all", "submitted", "under_review", "documentation_required", "approved", "rejected", "paid"];
const filterLabels: Record<string, string> = {
  all: "All Statuses",
  submitted: "Submitted",
  under_review: "Under Review",
  documentation_required: "Docs Required",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const maskEmail = (email: string | null, userId: string): string => {
  if (!email) return `user-${userId.slice(0, 4)}••••`;
  const [local, domain] = email.split("@");
  if (!domain) return `${email.slice(0, 2)}•••`;
  return `${local.slice(0, 1)}${"•".repeat(Math.min(local.length - 1, 4))}@${domain}`;
};

const PartnerClaims = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<PartnerClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState(false);
  const [taskFilter, setTaskFilter] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchClaims = async () => {
      try {
        const { data } = await supabase
          .from("claims")
          .select("id, status, est_payout, filed_at, updated_at, user_id, settlements(name, company, deadline)")
          .eq("partner_id", user.id)
          .order("updated_at", { ascending: false });

        if (!data) { setLoading(false); return; }

        const claimIds = data.map((c: any) => c.id);
        const userIds = [...new Set(data.map((c: any) => c.user_id))];

        const [docsRes, tasksRes, profilesRes] = await Promise.all([
          claimIds.length > 0 ? supabase.from("claim_documents").select("claim_id").in("claim_id", claimIds) : { data: [] },
          claimIds.length > 0 ? supabase.from("claim_tasks").select("claim_id, status").in("claim_id", claimIds) : { data: [] },
          userIds.length > 0 ? supabase.from("user_profiles").select("user_id, email").in("user_id", userIds) : { data: [] },
        ]);

        const docCountMap: Record<string, number> = {};
        (docsRes.data || []).forEach((d: any) => { docCountMap[d.claim_id] = (docCountMap[d.claim_id] || 0) + 1; });

        const taskCountMap: Record<string, number> = {};
        (tasksRes.data || []).filter((t: any) => t.status === "open").forEach((t: any) => { taskCountMap[t.claim_id] = (taskCountMap[t.claim_id] || 0) + 1; });

        const emailMap: Record<string, string | null> = {};
        (profilesRes.data || []).forEach((p: any) => { emailMap[p.user_id] = p.email; });

        setClaims(data.map((c: any) => ({
          id: c.id,
          settlement_name: c.settlements?.name || "Unknown",
          settlement_company: c.settlements?.company || "",
          user_email_masked: maskEmail(emailMap[c.user_id], c.user_id),
          status: c.status,
          est_payout: c.est_payout ? Number(c.est_payout) : null,
          filed_at: c.filed_at,
          updated_at: c.updated_at,
          doc_count: docCountMap[c.id] || 0,
          open_tasks: taskCountMap[c.id] || 0,
        })));
      } catch (error) {
        console.error("Error fetching partner claims:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [user]);

  let filtered = statusFilter === "all" ? claims : claims.filter(c => c.status === statusFilter);
  if (taskFilter) filtered = filtered.filter(c => c.open_tasks > 0);

  return (
    <div>
      <PageHeader title="Assigned Cases" subtitle="Cases assigned to you for review and processing" />

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{filterLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={taskFilter ? "default" : "outline"}
          className="rounded-xl text-xs"
          onClick={() => setTaskFilter(!taskFilter)}
        >
          <ListTodo className="mr-1 h-3 w-3" />Open Tasks
        </Button>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Case ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Est. Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Docs</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No cases found</td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/partner/claims/${c.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.settlement_company}</div>
                    <div className="text-xs text-muted-foreground">{c.settlement_name}</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill variant={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.filed_at || "—"}</td>
                  <td className="px-4 py-3 text-primary font-semibold">{c.est_payout ? `$${c.est_payout.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${c.doc_count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      <FileText className="h-3 w-3" /> {c.doc_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.open_tasks > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-warning font-semibold">
                        <AlertTriangle className="h-3 w-3" /> {c.open_tasks}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartnerClaims;
