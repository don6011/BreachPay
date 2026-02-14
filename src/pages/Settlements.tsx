import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Scale, DollarSign, Clock, ArrowRight, Shield, AlertTriangle, FileCheck,
  Zap, ChevronDown, Sparkles, TrendingUp, CheckCircle2, Target,
} from "lucide-react";
import type { SettlementStatus } from "@/types";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FilterTab = "all" | SettlementStatus | "filed";
type SortOption = "payout" | "deadline" | "newest";

const tabs: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Filed", value: "filed" },
  { label: "Closed", value: "closed" },
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
}

interface ClaimData {
  id: string;
  settlement_id: string;
  status: string;
  est_payout: number | null;
}

const Settlements = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortOption>("payout");
  const [showSort, setShowSort] = useState(false);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch user's settlement matches with settlement details
        const { data: matchData } = await supabase
          .from("settlement_matches")
          .select("settlement_id, match_reason, payout_estimate, settlements(id, name, company, breach_year, status, payout_min, payout_max, deadline, description)")
          .eq("user_id", user.id);

        if (matchData) {
          setSettlements(matchData.map((m: any) => ({
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
          })));
        }

        // Fetch user's claims
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

  const filtered = useMemo(() => {
    let list = [...settlements];
    if (filter === "filed") {
      list = list.filter((s) => claimMap[s.id]);
    } else if (filter !== "all") {
      list = list.filter((s) => s.status === filter);
    }

    list.sort((a, b) => {
      if (sort === "payout") return b.payout_max - a.payout_max;
      if (sort === "deadline") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return (b.breach_year || 0) - (a.breach_year || 0);
    });
    return list;
  }, [filter, sort, claimMap, settlements]);

  const openSettlements = settlements.filter((s) => s.status === "open");
  const totalMin = openSettlements.reduce((a, s) => a + s.payout_min, 0);
  const totalMax = openSettlements.reduce((a, s) => a + s.payout_max, 0);
  const claimsFiled = claims.length;
  const deadlinesApproaching = openSettlements.filter((s) => {
    const days = Math.ceil((new Date(s.deadline).getTime() - Date.now()) / 86400000);
    return days <= 60;
  }).length;

  const getFilingStatus = (settlementId: string) => {
    const claim = claimMap[settlementId];
    if (!claim) return "not_filed";
    return claim.status;
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
            {openSettlements.length > 0 ? "You Qualify for Compensation" : "No Matches Yet"}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">Eligible Settlements</p>
            <p className="text-2xl font-bold">{openSettlements.length}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">Estimated Compensation</p>
            <p className="text-2xl font-bold text-primary">${totalMin.toLocaleString()} – ${totalMax.toLocaleString()}</p>
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
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="rounded-xl shadow-[0_0_20px_hsl(172_89%_52%/0.25)] hover:shadow-[0_0_30px_hsl(172_89%_52%/0.4)] transition-all duration-300">
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
          {filtered.map((settlement, idx) => {
            const daysLeft = settlement.deadline ? Math.max(0, Math.ceil((new Date(settlement.deadline).getTime() - Date.now()) / 86400000)) : 0;
            const filingStatus = getFilingStatus(settlement.id);
            const claim = claimMap[settlement.id];
            const payoutProgress = claim && claim.est_payout ? Math.min(100, (Number(claim.est_payout) / settlement.payout_max) * 100) : 0;
            const isUrgent = daysLeft <= 30;
            const deadlineProgress = Math.max(0, Math.min(100, 100 - (daysLeft / 365) * 100));

            return (
              <div key={settlement.id}>
                {/* Auto-filing upsell after 2nd card */}
                {idx === 2 && (
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
                      <Button className="rounded-xl shadow-[0_0_16px_hsl(172_89%_52%/0.2)] hover:shadow-[0_0_24px_hsl(172_89%_52%/0.35)] transition-all duration-300 shrink-0">
                        <Sparkles className="mr-2 h-4 w-4" /> Enable Auto-Filing
                      </Button>
                    </div>
                  </div>
                )}

                <div className={`glass-card p-6 transition-all duration-300 hover:translate-y-[-1px] ${
                  settlement.status === "closed" ? "" : filingStatus === "approved" || filingStatus === "paid" ? "!border-success/30" : settlement.status === "open" ? "hover:border-primary/25" : ""
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{settlement.name}</h3>
                        {settlement.status === "open" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <CheckCircle2 className="h-2.5 w-2.5" /> ELIGIBLE
                          </span>
                        )}
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
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-lg font-bold text-primary drop-shadow-[0_0_8px_hsl(172_89%_52%/0.3)]">
                        ${settlement.payout_min.toLocaleString()} – ${settlement.payout_max.toLocaleString()}
                      </span>
                    </div>
                    {settlement.deadline && (
                      <div className={`flex items-center gap-1.5 text-sm ${isUrgent ? "text-critical" : "text-muted-foreground"}`}>
                        {isUrgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        <span className={isUrgent ? "font-semibold" : ""}>{daysLeft} days left</span>
                      </div>
                    )}
                    {settlement.status === "open" && filingStatus === "not_filed" && (
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
                  {settlement.status !== "closed" && settlement.deadline && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Deadline</span>
                        <span className={isUrgent ? "text-critical font-medium" : ""}>{settlement.deadline}</span>
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
                    {settlement.status === "open" && filingStatus === "not_filed" ? (
                      <Button size="sm" asChild className="rounded-xl shadow-[0_0_16px_hsl(172_89%_52%/0.2)] hover:shadow-[0_0_24px_hsl(172_89%_52%/0.35)] transition-all duration-300">
                        <Link to={`/claims/file?settlement=${settlement.id}`}>File Claim <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                    ) : filingStatus !== "not_filed" && filingStatus !== "paid" ? (
                      <Button size="sm" variant="outline" asChild className="rounded-xl">
                        <Link to="/claims">Track Claim</Link>
                      </Button>
                    ) : null}
                    {settlement.match_reason && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Matched via: <span className="text-primary">{settlement.match_reason}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Settlements;
