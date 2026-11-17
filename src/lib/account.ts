import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isOpen, sortByDeadline } from "@/lib/settlements/format";
import { PUBLIC_LIST_COLUMNS, type PublicSettlement, toSummary } from "@/lib/settlements/types";

/** A listed settlement that may relate to a breach found for this account. */
export interface AccountMatch {
  id: string;
  /** Why it was matched, e.g. the breach it relates to. */
  reason: string | null;
  settlement: PublicSettlement;
}

/** A claim the person is keeping track of. */
export interface TrackedClaim {
  id: string;
  settlementId: string;
  status: string;
  filedAt: string | null;
  updatedAt: string;
  settlement: PublicSettlement | null;
}

export interface LastCheck {
  id: string;
  completedAt: string | null;
  breaches: number;
  exposureScore: number;
}

export interface AccountAlert {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface AccountOverview {
  lastCheck: LastCheck | null;
  matches: AccountMatch[];
  claims: TrackedClaim[];
  alerts: AccountAlert[];
}

const SETTLEMENT_JOIN = `settlements(${PUBLIC_LIST_COLUMNS},verified,is_demo,is_test)`;

/** A settlement row as joined into matches and claims, with its publication flags. */
type JoinedSettlement = PublicSettlement & { verified?: boolean; is_demo?: boolean; is_test?: boolean };

interface ScanRow { id: string; completed_at: string | null; breaches_detected: number | null; risk_score: number | null }
interface MatchRow { id: string; scan_run_id: string | null; match_reason: string | null; settlements: JoinedSettlement | null }
interface ClaimRow { id: string; settlement_id: string; status: string; filed_at: string | null; updated_at: string; settlements: JoinedSettlement | null }
interface AlertRow { id: string; title: string; body: string | null; created_at: string; related_scan_run_id: string | null }

/** The same rule the public site applies: approved listings only. */
function isPublicSettlement(s: JoinedSettlement | null | undefined): s is JoinedSettlement {
  return !!s && s.verified === true && !s.is_demo && !s.is_test && s.status !== "rejected" && s.status !== "pending_review";
}

function asSettlement(s: JoinedSettlement): PublicSettlement {
  return toSummary(s);
}

/**
 * Loads what the signed-in pages need. Matches are kept only when they came
 * from a real breach check (Have I Been Pwned) or a partner referral, and only
 * for listings that are public, so nothing from test or demo jobs is shown.
 */
export async function fetchAccountOverview(userId: string): Promise<AccountOverview> {
  const [scansRes, matchesRes, claimsRes, alertsRes] = await Promise.all([
    supabase
      .from("scan_runs")
      .select("id, completed_at, breaches_detected, risk_score, created_at")
      .eq("user_id", userId)
      .eq("provider", "hibp")
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase
      .from("settlement_matches")
      .select(`id, settlement_id, scan_run_id, match_reason, ${SETTLEMENT_JOIN}`)
      .eq("user_id", userId),
    supabase
      .from("claims")
      .select(`id, settlement_id, status, filed_at, updated_at, created_at, ${SETTLEMENT_JOIN}`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("id, title, body, created_at, related_scan_run_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (scansRes.error) throw new Error(scansRes.error.message);
  if (matchesRes.error) throw new Error(matchesRes.error.message);
  if (claimsRes.error) throw new Error(claimsRes.error.message);

  const scans = (scansRes.data ?? []) as unknown as ScanRow[];
  const liveScanIds = new Set(scans.map((s) => s.id));
  const latest = scans[0];

  const matches: AccountMatch[] = ((matchesRes.data ?? []) as unknown as MatchRow[])
    .filter(
      (m) =>
        isPublicSettlement(m.settlements) &&
        ((!!m.scan_run_id && liveScanIds.has(m.scan_run_id)) || String(m.match_reason ?? "").startsWith("Partner referral")),
    )
    .map((m) => ({ id: m.id, reason: m.match_reason ?? null, settlement: asSettlement(m.settlements as JoinedSettlement) }));

  // Soonest deadline first, closed ones last.
  const order = new Map(sortByDeadline(matches.map((m) => m.settlement)).map((s, i) => [s.id, i]));
  matches.sort(
    (a, b) =>
      Number(!isOpen(a.settlement)) - Number(!isOpen(b.settlement)) ||
      (order.get(a.settlement.id) ?? 0) - (order.get(b.settlement.id) ?? 0),
  );

  const claims: TrackedClaim[] = ((claimsRes.data ?? []) as unknown as ClaimRow[]).map((c) => ({
    id: c.id,
    settlementId: c.settlement_id,
    status: c.status,
    filedAt: c.filed_at ?? null,
    updatedAt: c.updated_at,
    settlement: isPublicSettlement(c.settlements) ? asSettlement(c.settlements) : null,
  }));

  // Alerts raised by anything other than a real breach check are left out.
  const alerts: AccountAlert[] = ((alertsRes.data ?? []) as unknown as AlertRow[])
    .filter((a) => !a.related_scan_run_id || liveScanIds.has(a.related_scan_run_id))
    .slice(0, 6)
    .map((a) => ({ id: a.id, title: a.title, body: a.body ?? "", createdAt: a.created_at }));

  return {
    alerts,
    lastCheck: latest
      ? {
          id: latest.id,
          completedAt: latest.completed_at ?? null,
          breaches: latest.breaches_detected ?? 0,
          exposureScore: latest.risk_score ?? 0,
        }
      : null,
    matches,
    claims,
  };
}

const overviewKey = (userId: string | undefined) => ["account-overview", userId] as const;

export function useAccountOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: overviewKey(user?.id),
    queryFn: () => fetchAccountOverview(user!.id),
    enabled: !!user,
  });
}

/** Turns the database's refusal reasons into something a person can act on. */
function explainRefusal(reason: string | undefined): string {
  const r = (reason ?? "").toLowerCase();
  if (r.includes("deadline") || r.includes("closed")) return "This settlement is no longer open for claims.";
  if (r.includes("locked") || r.includes("too many")) return "Too many changes in a short time. Please try again tomorrow.";
  if (r.includes("no matching")) return "Only settlements from your matches can be tracked here.";
  return "This couldn't be saved. Please try again.";
}

/**
 * Records that the person filed their claim on the official site. BreachPay
 * does not file anything: this only keeps their own list up to date.
 */
export function useMarkClaimFiled() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (match: AccountMatch) => {
      if (!user) throw new Error("Please log in again.");

      const { data, error } = await supabase.rpc("rpc_start_claim_guarded", {
        p_settlement_id: match.settlement.id,
        p_match_id: match.id,
      });
      if (error) throw new Error("This couldn't be saved. Please try again.");
      const started = data as { allowed?: boolean; reason?: string; claim_id?: string };
      if (!started?.allowed || !started.claim_id) throw new Error(explainRefusal(started?.reason));

      const now = new Date();
      const { error: updateError } = await supabase
        .from("claims")
        .update({
          status: "submitted",
          submission_channel: "redirect_official",
          filed_at: now.toISOString().slice(0, 10),
          updated_at: now.toISOString(),
        })
        .eq("id", started.claim_id)
        .eq("user_id", user.id);
      if (updateError) throw new Error("This couldn't be saved. Please try again.");

      await supabase.from("claim_status_history").insert({
        claim_id: started.claim_id,
        status: "submitted",
        note: "User confirmed submission on official settlement website.",
        updated_by: "user",
      });
      return started.claim_id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: overviewKey(user?.id) }),
  });
}

/** Plain-language label for a claim's stored status. */
export function claimStatusLabel(status: string): { label: string; tone: "done" | "todo" | "info" | "bad" } {
  switch (status) {
    case "draft":
      return { label: "Not filed yet", tone: "todo" };
    case "submitted":
    case "under_review":
      return { label: "Filed", tone: "done" };
    case "documentation_required":
      return { label: "More information requested", tone: "info" };
    case "approved":
      return { label: "Approved", tone: "done" };
    case "paid":
      return { label: "Paid", tone: "done" };
    case "rejected":
      return { label: "Denied", tone: "bad" };
    default:
      return { label: status.replace(/_/g, " "), tone: "info" };
  }
}
