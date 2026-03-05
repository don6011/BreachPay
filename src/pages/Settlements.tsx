import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DeadlineBadge, isDeadlinePassed } from "@/components/DeadlineBadge";
import { PayoutRange } from "@/components/PayoutRange";
import {
  Scale, DollarSign, Clock, ArrowRight, Shield, AlertTriangle, FileCheck,
  Zap, ChevronDown, Sparkles, TrendingUp, CheckCircle2, Target,
  ExternalLink, XCircle, Info, ChevronRight,
} from "lucide-react";
import type { SettlementStatus } from "@/types";
import { Link, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type FilterTab = "all" | SettlementStatus | "filed";
type SortOption = "payout" | "deadline" | "newest";

const tabs: { label: string; value: FilterTab | "verified" | "filed" }[] = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Filed", value: "filed" },
];

const sortOptions: { label: string; value: SortOption }[] = [
  { label: "Highest Payout", value: "payout" },
  { label: "Closing Soon", value: "deadline" },
  { label: "Newest Match", value: "newest" },
];

interface SettlementData {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  status: string;
  payout_min: number;
  payout_max: number;
  deadline: string;
  description: string | null;
  match_reason: string | null;
  payout_estimate: number | null;
  confidence_score: number;
  confidence_level: string;
  verified: boolean;
  verification_level: string;
  jurisdiction: string | null;
  case_number: string | null;
  administrator_name: string | null;
  official_source_url: string | null;
  claims_filing_url: string | null;
  claim_deadline: string | null;
  source_url: string | null;
  lifecycle_status: string;
  closed_at: string | null;
}

interface ClaimData {
  id: string;
  settlement_id: string;
  status: string;
  est_payout: number | null;
}

// Parse match_reason string into structured reasons for "Why this match?" drawer
const parseMatchReasons = (reason: string | null): { icon: "check" | "warn"; text: string }[] => {
  if (!reason) return [];
  return reason.split("; ").map((r) => ({
    icon: r.toLowerCase().includes("fuzzy") || r.toLowerCase().includes("capped") || r.toLowerCase().includes("partial") ? "warn" : "check",
    text: r,
  }));
};

const confidenceBadgeStyles = (level: string, score: number) => {
  if (level === "strong") return "bg-success/10 text-success border-success/20";
  if (level === "medium") return "bg-warning/10 text-warning border-warning/20";
  if (level === "weak") return "bg-muted text-muted-foreground border-border";
  return "bg-muted/50 text-muted-foreground border-border";
};

const Settlements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortOption>("payout");
  const [showSort, setShowSort] = useState(false);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filingId, setFilingId] = useState<string | null>(null);
  const [detailSettlement, setDetailSettlement] = useState<SettlementData | null>(null);
  const [showPossible, setShowPossible] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  // Label for weak matches section

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data: matchData } = await supabase
          .from("settlement_matches")
          .select("settlement_id, match_reason, payout_estimate, confidence_score, confidence_level, settlements(id, name, company, breach_year, status, payout_min, payout_max, deadline, description, verified, verification_level, jurisdiction, case_number, administrator_name, official_source_url, claims_filing_url, claim_deadline, source_url, lifecycle_status, closed_at, is_demo, is_test)")
          .eq("user_id", user.id);

        if (matchData) {
          setSettlements(matchData
            .filter((m: any) => m.settlements && !m.settlements.is_demo && !m.settlements.is_test)
            .map((m: any) => ({
              id: m.settlements?.id || m.settlement_id,
              name: m.settlements?.name || "Unknown",
              company: m.settlements?.company || "",
              breach_year: m.settlements?.breach_year,
              status: m.settlements?.status || "open",
              payout_min: Number(m.settlements?.payout_min) || 0,
              payout_max: Number(m.settlements?.payout_max) || 0,
              deadline: m.settlements?.deadline || "",
              description: m.settlements?.description,
              match_reason: m.match_reason,
              payout_estimate: m.payout_estimate ? Number(m.payout_estimate) : null,
              confidence_score: m.confidence_score ?? 50,
              confidence_level: m.confidence_level || "medium",
              verified: m.settlements?.verified || false,
              verification_level: m.settlements?.verification_level || "unverified",
              jurisdiction: m.settlements?.jurisdiction,
              case_number: m.settlements?.case_number,
              administrator_name: m.settlements?.administrator_name,
              official_source_url: m.settlements?.official_source_url,
              claims_filing_url: m.settlements?.claims_filing_url,
              claim_deadline: m.settlements?.claim_deadline,
              source_url: m.settlements?.source_url,
              lifecycle_status: m.settlements?.lifecycle_status || "active",
              closed_at: m.settlements?.closed_at || null,
            })));
        }

        const { data: claimsData } = await supabase
          .from("claims")
          .select("id, settlement_id, status, est_payout")
          .eq("user_id", user.id);

        if (claimsData) setClaims(claimsData);
      } catch (error) {
        console.error("Error fetching settlements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const claimMap = useMemo(() => {
    const map: Record<string, ClaimData> = {};
    claims.forEach((c) => (map[c.settlement_id] = c));
    return map;
  }, [claims]);

  // Active settlements (not closed/archived, deadline not passed)
  const activeSettlementsList = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return settlements.filter((s) => {
      if (s.lifecycle_status !== "active") return false;
      if (s.claim_deadline && s.claim_deadline < today) return false;
      return true;
    });
  }, [settlements]);

  // Closed settlements
  const closedSettlementsList = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return settlements.filter((s) => {
      return s.lifecycle_status !== "active" || (s.claim_deadline && s.claim_deadline < today);
    });
  }, [settlements]);

  // Primary matches: active + verified/open AND confidence >= 40
  const primaryMatches = useMemo(() => {
    return activeSettlementsList.filter(
      (s) => (s.status === "verified" || s.status === "open") && s.confidence_score >= 40
    );
  }, [activeSettlementsList]);

  // Hidden/possible matches: confidence < 40 (or non-verified)
  const possibleMatches = useMemo(() => {
    return activeSettlementsList.filter(
      (s) => (s.status === "verified" || s.status === "open") && s.confidence_score < 40
    );
  }, [activeSettlementsList]);

  const filtered = useMemo(() => {
    let list = [...primaryMatches];
    if (filter === "filed") {
      list = list.filter((s) => claimMap[s.id]);
    } else if (filter === "verified") {
      list = list.filter((s) => s.verified);
    }
    list.sort((a, b) => {
      if (sort === "payout") return b.payout_max - a.payout_max;
      if (sort === "deadline") {
        const da = a.claim_deadline || a.deadline;
        const db = b.claim_deadline || b.deadline;
        return new Date(da).getTime() - new Date(db).getTime();
      }
      return (b.breach_year || 0) - (a.breach_year || 0);
    });
    return list;
  }, [filter, sort, claimMap, primaryMatches]);

  const openSettlements = primaryMatches;
  const totalMin = openSettlements.reduce((a, s) => a + s.payout_min, 0);
  const totalMax = openSettlements.reduce((a, s) => a + s.payout_max, 0);
  const claimsFiled = claims.length;
  const deadlinesApproaching = openSettlements.filter((s) => {
    const dl = s.claim_deadline || s.deadline;
    const days = Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000);
    return days <= 60;
  }).length;

  const getFilingStatus = (settlementId: string) => {
    const claim = claimMap[settlementId];
    if (!claim) return "not_filed";
    return claim.status;
  };

  const handleFileClaim = async (settlement: SettlementData) => {
    if (!user || filingId) return;
    setFilingId(settlement.id);
    try {
      // Check for existing claim (draft or submitted)
      const { data: existing } = await supabase
        .from("claims")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("settlement_id", settlement.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === "draft") {
          // Resume draft wizard
          navigate(`/claims/file?settlement=${settlement.id}`);
        } else {
          navigate(`/claims/${existing.id}`);
        }
        return;
      }

      // Navigate to wizard — draft will be created there
      navigate(`/claims/file?settlement=${settlement.id}`);
    } catch (err) {
      console.error("File claim error:", err);
      toast({ title: "Error", description: "Failed to start claim. Please try again.", variant: "destructive" });
    } finally {
      setFilingId(null);
    }
  };

  const getEffectiveDeadline = (s: SettlementData) => s.claim_deadline || s.deadline;

  const renderSettlementCard = (settlement: SettlementData, idx: number, showUpsell = true) => {
    const effectiveDeadline = getEffectiveDeadline(settlement);
    const daysLeft = effectiveDeadline ? Math.max(0, Math.ceil((new Date(effectiveDeadline).getTime() - Date.now()) / 86400000)) : 0;
    const filingStatus = getFilingStatus(settlement.id);
    const claim = claimMap[settlement.id];
    const payoutProgress = claim && claim.est_payout ? Math.min(100, (Number(claim.est_payout) / settlement.payout_max) * 100) : 0;
    const isUrgent = daysLeft <= 30;
    const deadlineProgress = Math.max(0, Math.min(100, 100 - (daysLeft / 365) * 100));
    const reasons = parseMatchReasons(settlement.match_reason);

    return (
      <div key={settlement.id}>
        {/* Auto-filing upsell after 2nd card */}
        {showUpsell && idx === 2 && (
          <div className="mb-3 glass-card-glow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Let Us File For You</h3>
                  <p className="text-sm text-muted-foreground">
                    We prepare and submit all eligible claims automatically. <span className="text-primary font-medium">15% fee only if paid.</span>
                  </p>
                </div>
              </div>
              <Button className="rounded-xl shadow-[0_0_16px_hsl(164_100%_45%/0.2)] hover:shadow-[0_0_24px_hsl(164_100%_45%/0.35)] transition-all duration-300 shrink-0">
                <Sparkles className="mr-2 h-4 w-4" /> Enable Auto-Filing
              </Button>
            </div>
          </div>
        )}

        <div className={`glass-card p-6 transition-all duration-300 hover:translate-y-[-1px] ${
          settlement.lifecycle_status !== "active" || settlement.status === "closed" ? "opacity-60" : filingStatus === "approved" || filingStatus === "paid" ? "!border-success/30" : settlement.status === "open" ? "hover:border-primary/25" : ""
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold">{settlement.name}</h3>
                {settlement.lifecycle_status !== "active" || isDeadlinePassed(effectiveDeadline) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <XCircle className="h-2.5 w-2.5" /> CLOSED
                  </span>
                ) : (settlement.status === "open" || settlement.status === "verified") ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <CheckCircle2 className="h-2.5 w-2.5" /> ELIGIBLE
                  </span>
                ) : null}
                <VerificationBadge
                  level={settlement.verification_level}
                  verified={settlement.verified}
                  compact
                />
                <DeadlineBadge deadline={effectiveDeadline} />
              </div>
              <p className="text-xs text-muted-foreground">{settlement.company} · {settlement.breach_year}</p>
            </div>
            <div className="flex items-center gap-2">
              {filingStatus !== "not_filed" && <StatusPill variant={filingStatus as any} />}
              <StatusPill variant={settlement.status as any} />
            </div>
          </div>

          {settlement.description && (
            <p className="text-sm text-muted-foreground mb-4">{settlement.description}</p>
          )}

          {/* Payout + Deadline Row */}
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <PayoutRange min={settlement.payout_min} max={settlement.payout_max} />
            {effectiveDeadline && (
              <div className={`flex items-center gap-1.5 text-sm ${isUrgent ? "text-critical" : "text-muted-foreground"}`}>
                {isUrgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                <span className={isUrgent ? "font-semibold" : ""}>{daysLeft} days left</span>
              </div>
            )}
            {(settlement.official_source_url || settlement.source_url) && (
              <a href={settlement.official_source_url || settlement.source_url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline">
                <ExternalLink className="h-2.5 w-2.5" /> View source
              </a>
            )}
            {(settlement.status === "open" || settlement.status === "verified") && filingStatus === "not_filed" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      <Zap className="h-2.5 w-2.5" /> One-Click Filing
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-card border text-sm">
                    File this claim instantly with your saved profile data.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Deadline Countdown Bar */}
          {settlement.status !== "closed" && effectiveDeadline && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Filing deadline</span>
                <span className={isUrgent ? "text-critical font-medium" : ""}>{effectiveDeadline}</span>
              </div>
              <Progress value={deadlineProgress} className={`h-1.5 ${isUrgent ? "[&>div]:bg-critical" : ""}`} />
            </div>
          )}

          {/* Payout Progress Bar (for filed claims) */}
          {claim && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Claim Value</span>
                <span className="text-primary font-medium">${Number(claim.est_payout || 0).toLocaleString()}</span>
              </div>
              <Progress value={payoutProgress} className="h-1.5 bg-muted" />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1">
            <Button size="sm" variant="ghost" className="rounded-xl text-xs" onClick={() => setDetailSettlement(settlement)}>
              Details
            </Button>
            {settlement.lifecycle_status !== "active" || settlement.status === "closed" || isDeadlinePassed(effectiveDeadline) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                <XCircle className="h-3 w-3" /> Filing Closed
                {settlement.closed_at && <span className="ml-1 text-[10px]">({new Date(settlement.closed_at).toLocaleDateString()})</span>}
              </span>
            ) : (settlement.status === "open" || settlement.status === "verified") && filingStatus === "not_filed" ? (
              <Button
                size="sm"
                className="rounded-xl shadow-[0_0_16px_hsl(172_89%_52%/0.2)] hover:shadow-[0_0_24px_hsl(172_89%_52%/0.35)] transition-all duration-300"
                disabled={filingId === settlement.id}
                onClick={() => handleFileClaim(settlement)}
              >
                {filingId === settlement.id ? (
                  <><span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-1" /> Filing...</>
                 ) : settlement.confidence_level === "high" ? (
                  <>Start My Claim <ArrowRight className="ml-1 h-3 w-3" /></>
                 ) : (
                  <>Check Eligibility <ArrowRight className="ml-1 h-3 w-3" /></>
                 )}
              </Button>
            ) : filingStatus !== "not_filed" && filingStatus !== "paid" ? (
              <Button size="sm" variant="outline" asChild className="rounded-xl">
                <Link to={`/claims/${claimMap[settlement.id]?.id}`}>Track Claim</Link>
              </Button>
            ) : null}

            {/* Confidence badge + Why this match? */}
            {settlement.confidence_level && (
              <Sheet>
                <SheetTrigger asChild>
                  <button className={`inline-flex items-center gap-1 text-xs font-medium ml-auto rounded-full px-2.5 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${confidenceBadgeStyles(settlement.confidence_level, settlement.confidence_score)}`}>
                    <Target className="h-2.5 w-2.5" />
                    {settlement.confidence_score}% {settlement.confidence_level}
                    <Info className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                  </button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Why this match?</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`rounded-full p-2.5 ${confidenceBadgeStyles(settlement.confidence_level, settlement.confidence_score)}`}>
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{settlement.confidence_score}%</p>
                        <p className="text-sm text-muted-foreground capitalize">{settlement.confidence_level} match confidence</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match Criteria</p>
                      {reasons.length > 0 ? reasons.map((r, i) => (
                        <div key={i} className={`flex items-start gap-2.5 rounded-xl p-3 ${r.icon === "check" ? "bg-success/5 border border-success/10" : "bg-warning/5 border border-warning/10"}`}>
                          {r.icon === "check" ? (
                            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                          )}
                          <span className="text-sm">{r.text}</span>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">No detailed match reasons available.</p>
                      )}
                    </div>

                    <div className="rounded-xl border p-4 space-y-2 mt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settlement Details</p>
                      <p className="text-sm font-medium">{settlement.name}</p>
                      <p className="text-xs text-muted-foreground">{settlement.company} · {settlement.breach_year || "Year unknown"}</p>
                      <PayoutRange min={settlement.payout_min} max={settlement.payout_max} size="sm" />
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Match scores are computed by comparing your detected breach exposures against settlement records. A higher score indicates stronger alignment on company, year, and data types exposed.
                    </p>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Settlement Matches" subtitle="Your eligible settlement matches and claim opportunities" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settlement Matches" subtitle="Your eligible settlement matches and claim opportunities" />

      {/* Compensation Summary Banner */}
      <div className="mb-6 glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">
            {openSettlements.length > 0 ? "You May Qualify for Compensation" : "No Matches Yet"}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">Eligible Settlements</p>
            <p className="text-2xl font-bold">{openSettlements.length}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">Estimated Range</p>
            <PayoutRange min={totalMin} max={totalMax} size="sm" className="text-2xl" />
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">Claims Filed</p>
            <p className="text-2xl font-bold">{claimsFiled}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">Deadlines Approaching</p>
            <p className="text-2xl font-bold text-warning">{deadlinesApproaching}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Eligibility depends on settlement administrator review. Estimated amounts may vary.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="rounded-xl shadow-[0_0_20px_hsl(164_100%_45%/0.25)] hover:shadow-[0_0_30px_hsl(164_100%_45%/0.4)] transition-all duration-300">
            <Link to="/claims"><FileCheck className="mr-2 h-4 w-4" /> File All Eligible Claims</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/claims"><TrendingUp className="mr-2 h-4 w-4" /> View Claim Portfolio</Link>
          </Button>
        </div>
      </div>

      {/* Filter + Sort Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                filter === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sort: {sortOptions.find((s) => s.value === sort)?.label}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 z-10 glass-card p-1 shadow-lg min-w-[180px]">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSort(opt.value); setShowSort(false); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                    sort === opt.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settlement Cards */}
      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          {settlements.length === 0 ? "No settlement matches yet. Run a scan to find eligible settlements." : "No settlements match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((settlement, idx) => renderSettlementCard(settlement, idx))}
        </div>
      )}

      {/* Possible Opportunities (hidden by default, < 40 confidence) */}
      {possibleMatches.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowPossible(!showPossible)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${showPossible ? "rotate-90" : ""}`} />
            <span>Possible Opportunities ({possibleMatches.length})</span>
            <span className="text-xs bg-muted rounded-full px-2 py-0.5">Low confidence</span>
          </button>
          {showPossible && (
            <div className="space-y-3 opacity-75">
              {possibleMatches.map((s, i) => renderSettlementCard(s, i, false))}
            </div>
          )}
        </div>
      )}

      {/* Settlement Detail Dialog */}
      <Dialog open={!!detailSettlement} onOpenChange={(open) => !open && setDetailSettlement(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailSettlement?.name}</DialogTitle>
          </DialogHeader>
          {detailSettlement && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{detailSettlement.company} · {detailSettlement.breach_year} Breach</p>
              {detailSettlement.description && <p className="text-sm text-muted-foreground">{detailSettlement.description}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Estimated Payout</p>
                  <PayoutRange min={detailSettlement.payout_min} max={detailSettlement.payout_max} size="sm" />
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Filing Deadline</p>
                  <p className="text-sm font-bold">{getEffectiveDeadline(detailSettlement) || "—"}</p>
                </div>
              </div>

              {/* Verification & Source Panel */}
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">Verification & Source</h4>
                <VerificationBadge
                  level={detailSettlement.verification_level}
                  verified={detailSettlement.verified}
                  sourceUrl={detailSettlement.official_source_url || detailSettlement.source_url}
                />
                {detailSettlement.jurisdiction && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Jurisdiction:</span>
                    <span>{detailSettlement.jurisdiction}</span>
                  </div>
                )}
                {detailSettlement.case_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Case:</span>
                    <span>{detailSettlement.case_number}</span>
                  </div>
                )}
                {detailSettlement.administrator_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Administrator:</span>
                    <span>{detailSettlement.administrator_name}</span>
                  </div>
                )}
                {detailSettlement.claims_filing_url && (
                  <a href={detailSettlement.claims_filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline rounded-lg bg-primary/5 px-2.5 py-1.5">
                    <ExternalLink className="h-3 w-3" /> Claims filing site
                  </a>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Eligibility depends on settlement administrator review. Estimated payouts are pending review and subject to settlement terms.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settlements;
