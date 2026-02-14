import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface AutomationRun {
  id: string;
  job_name: string;
  run_key: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  details: Record<string, unknown>;
}

const AdminAutomationLogs = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("automation_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    if (data) setRuns(data as AutomationRun[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchRuns();
  }, [user]);

  const statusVariant = (status: string) => {
    if (status === "completed" || status === "success") return "open" as const;
    if (status === "running") return "pending" as const;
    return "closed" as const;
  };

  const duration = (start: string, end: string | null) => {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div>
      <PageHeader title="Automation Logs" subtitle="Edge function execution history">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchRuns} disabled={loading}>
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Run Key</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Started</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No automation runs yet</td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.job_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.run_key.slice(0, 16)}</td>
                  <td className="px-4 py-3"><StatusPill variant={statusVariant(r.status)} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">{duration(r.started_at, r.completed_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                    {JSON.stringify(r.details)}
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

export default AdminAutomationLogs;
