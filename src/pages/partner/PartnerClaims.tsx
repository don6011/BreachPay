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
  assignment_status: string;
  est_payout: number | null;
  filed_at: string | null;
  updated_at: string;
  doc_count: number;
}

const statusOptions = ["all", "submitted", "under_review", "documentation_required", "approved", "rejected", "paid"];
const assignmentOptions = ["all", "assigned", "in_progress", "completed", "rejected"];
const filterLabels: Record<string, string> = {
  all: "All",
  submitted: "Submitted",
  under_review: "Under Review",
  documentation_required: "Docs Required",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
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
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  useEffect(() => {
    if (!user) return;

    const fetchClaims = async () => {
      try {
        // Get partner org
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!pu) { setLoading(false); return; }

        // Get assignments with claims
        const { data } = await supabase
          .from("claim_assignments")
          .select("assignment_status, claims(id, status, est_payout, filed_at, updated_at, user_id, settlements(name, company))")
          .eq("partner_id", pu.partner_id)
          .order("assigned_at", { ascending: false });

        if (!data) { setLoading(false); return; }

        const claimIds = data.map((a: any) => a.claims?.id).filter(Boolean);
        const userIds = [...new Set(data.map((a: any) => a.claims?.user_id).filter(Boolean))];

        const [docsRes, profilesRes] = await Promise.all([
          claimIds.length > 0 ? supabase.from("claim_documents").select("claim_id").in("claim_id", claimIds) : { data: [] },
          userIds.length > 0 ? supabase.from("user_profiles").select("user_id, email").in("user_id", userIds) : { data: [] },
        ]);

        const docCountMap: Record<string, number> = {};
        (docsRes.data || []).forEach((d: any) => { docCountMap[d.claim_id] = (docCountMap[d.claim_id] || 0) + 1; });

        const emailMap: Record<string, string | null> = {};
        (profilesRes.data || []).forEach((p: any) => { emailMap[p.user_id] = p.email; });

        setClaims(data.filter((a: any) => a.claims).map((a: any) => ({
          id: a.claims.id,
          settlement_name: a.claims.settlements?.name || "Unknown",
          settlement_company: a.claims.settlements?.company || "",
          user_email_masked: maskEmail(emailMap[a.claims.user_id], a.claims.user_id),
          status: a.claims.status,
          assignment_status: a.assignment_status,
          est_payout: a.claims.est_payout ? Number(a.claims.est_payout) : null,
          filed_at: a.claims.filed_at,
          updated_at: a.claims.updated_at,
          doc_count: docCountMap[a.claims.id] || 0,
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
  if (assignmentFilter !== "all") filtered = filtered.filter(c => c.assignment_status === assignmentFilter);

  return (
    <div>
      <PageHeader title="Assigned Cases" subtitle="Cases assigned to your organization for review and processing" />

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder="Claim status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{filterLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder="Assignment status" />
          </SelectTrigger>
          <SelectContent>
            {assignmentOptions.map(s => (
              <SelectItem key={s} value={s}>{filterLabels[s]}</SelectItem>
            ))}
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Est. Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Docs</th>
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
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.assignment_status === "completed" ? "bg-success/10 text-success" :
                      c.assignment_status === "in_progress" ? "bg-primary/10 text-primary" :
                      c.assignment_status === "rejected" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {c.assignment_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.filed_at || "—"}</td>
                  <td className="px-4 py-3 text-primary font-semibold">{c.est_payout ? `$${c.est_payout.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${c.doc_count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      <FileText className="h-3 w-3" /> {c.doc_count}
                    </span>
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
