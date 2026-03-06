import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, ArrowRight } from "lucide-react";

interface DeadlineMatch {
  settlement_id: string;
  settlement_name: string;
  company: string;
  deadline: string;
  days_left: number;
  claim_exists: boolean;
}

export function DeadlineCountdown() {
  const { user } = useAuth();
  const [deadlines, setDeadlines] = useState<DeadlineMatch[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: matches } = await supabase
        .from("settlement_matches")
        .select("settlement_id, settlements(id, name, company, claim_deadline, deadline, is_demo, is_test, lifecycle_status, status)")
        .eq("user_id", user.id);

      if (!matches) return;

      // Check existing claims
      const { data: claims } = await supabase
        .from("claims")
        .select("settlement_id")
        .eq("user_id", user.id);

      const claimSettlementIds = new Set((claims || []).map((c: any) => c.settlement_id));

      const items: DeadlineMatch[] = [];
      for (const m of matches as any[]) {
        const s = m.settlements;
        if (!s) continue;
        if (s.is_demo || s.is_test) continue;
        if (s.lifecycle_status !== "active") continue;
        if (s.status !== "verified" && s.status !== "open") continue;
        const dl = s.claim_deadline || s.deadline;
        if (!dl) continue;
        const daysLeft = Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 0 || daysLeft > 60) continue;
        items.push({
          settlement_id: s.id,
          settlement_name: s.name,
          company: s.company,
          deadline: dl,
          days_left: daysLeft,
          claim_exists: claimSettlementIds.has(s.id),
        });
      }

      items.sort((a, b) => a.days_left - b.days_left);
      setDeadlines(items.slice(0, 3));
    };
    fetch();
  }, [user]);

  if (deadlines.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-destructive" />
        <h2 className="text-lg font-semibold">Filing Deadlines</h2>
      </div>
      {deadlines.map(d => {
        const isUrgent = d.days_left <= 14;
        return (
          <div
            key={d.settlement_id}
            className={`glass-card p-4 flex items-center justify-between gap-4 ${
              isUrgent ? "border-destructive/30" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {isUrgent ? (
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              ) : (
                <Clock className="h-5 w-5 text-warning shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{d.settlement_name}</p>
                <p className="text-xs text-muted-foreground">{d.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`text-right ${isUrgent ? "text-destructive" : "text-warning"}`}>
                <p className="text-lg font-bold">{d.days_left}</p>
                <p className="text-[10px] uppercase tracking-wider">days left</p>
              </div>
              {!d.claim_exists && (
                <Button size="sm" className="rounded-xl" asChild>
                  <Link to={`/claims/file?settlement=${d.settlement_id}`}>
                    File Now <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
