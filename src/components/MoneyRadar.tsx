import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, ArrowRight, Radar, Shield, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface Opportunity {
  matchId: string;
  settlementId: string;
  settlementName: string;
  estimatedPayout: number;
  claimDeadline: string | null;
  confidenceScore: number;
}

const confidenceBadge = (score: number) => {
  if (score >= 85) return { label: "Strong", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (score >= 70) return { label: "Medium", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: "Weak", className: "bg-muted text-muted-foreground border-border" };
};

export const MoneyRadar = () => {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data } = await supabase
          .from("settlement_matches")
          .select("id, settlement_id, payout_estimate, confidence_score, settlements(name, payout_min, payout_max, claim_deadline, status, is_demo, is_test, lifecycle_status)")
          .eq("user_id", user.id)
          .gte("confidence_score", 70);

        if (data) {
          const filtered = data.filter((m: any) => {
            const s = m.settlements;
            if (!s) return false;
            if (s.is_demo || s.is_test) return false;
            if (s.status !== "verified") return false;
            if (s.lifecycle_status !== "active") return false;
            if (s.claim_deadline && s.claim_deadline < today) return false;
            return true;
          });

          setOpportunities(
            filtered.map((m: any) => {
              const s = m.settlements;
              const est = m.payout_estimate ??
                (s.payout_max ? (Number(s.payout_min || 0) + Number(s.payout_max)) / 2 : Number(s.payout_min || 0));
              return {
                matchId: m.id,
                settlementId: m.settlement_id,
                settlementName: s.name,
                estimatedPayout: est,
                claimDeadline: s.claim_deadline,
                confidenceScore: m.confidence_score,
              };
            }).sort((a: Opportunity, b: Opportunity) => b.estimatedPayout - a.estimatedPayout)
          );
        }
      } catch (e) {
        console.error("MoneyRadar fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const totalRecovery = opportunities.reduce((sum, o) => sum + o.estimatedPayout, 0);

  if (loading) return null;
  if (opportunities.length === 0) return null;

  return (
    <div className="glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Money Radar</h2>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
          {opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"}
        </Badge>
      </div>

      {/* Total Recovery */}
      <div className="mb-5 rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">Estimated Recovery Opportunities</p>
        <p className="text-2xl font-bold gradient-emerald-text">${totalRecovery.toLocaleString()}</p>
      </div>

      {/* Opportunity List */}
      <div className="space-y-3">
        {opportunities.slice(0, 5).map((opp) => {
          const badge = confidenceBadge(opp.confidenceScore);
          const daysLeft = opp.claimDeadline
            ? Math.ceil((new Date(opp.claimDeadline).getTime() - Date.now()) / 86400000)
            : null;

          return (
            <div key={opp.matchId} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/50 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{opp.settlementName}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                    {badge.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${opp.estimatedPayout.toLocaleString()}
                  </span>
                  {daysLeft !== null && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {daysLeft}d left
                    </span>
                  )}
                </div>
              </div>
              <Button size="sm" className="rounded-xl text-xs shrink-0" asChild>
                <Link to={`/settlements/${opp.settlementId}`}>
                  Start Claim <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>

      {opportunities.length > 5 && (
        <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" asChild>
          <Link to="/settlements">View all {opportunities.length} opportunities <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      )}
    </div>
  );
};
