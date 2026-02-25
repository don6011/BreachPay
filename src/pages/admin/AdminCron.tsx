import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScanJobQueue, useRetryJob } from "@/hooks/useScanSchedule";
import { supabase } from "@/integrations/supabase/client";
import { Timer, RefreshCw, Play, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  queued: "bg-warning/10 text-warning border-warning/30",
  running: "bg-primary/10 text-primary border-primary/30",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Timer className="h-3 w-3" />,
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  success: <CheckCircle className="h-3 w-3" />,
  failed: <AlertTriangle className="h-3 w-3" />,
};

export default function AdminCron() {
  const [filter, setFilter] = useState("all");
  const { data: jobs, isLoading, refetch } = useScanJobQueue(filter);
  const retryJob = useRetryJob();
  const [triggering, setTriggering] = useState(false);

  const handleTriggerCron = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-scan-queue");
      if (error) throw error;
      toast({ title: "Cron triggered", description: JSON.stringify(data) });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob.mutateAsync(jobId);
      toast({ title: "Job re-queued" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader title="Cron & Job Queue" subtitle="Scan scheduling infrastructure" />

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" className="rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>

        <Button className="rounded-xl ml-auto" onClick={handleTriggerCron} disabled={triggering}>
          <Play className="mr-2 h-4 w-4" />{triggering ? "Running..." : "Trigger Cron Now"}
        </Button>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Run At</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : !jobs?.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No jobs found</td></tr>
            ) : (
              jobs.map((job: any) => {
                const duration = job.started_at && job.finished_at
                  ? `${((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(1)}s`
                  : "—";
                return (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusColors[job.status] || ""}>
                        <span className="flex items-center gap-1.5">{statusIcons[job.status]} {job.status}</span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{(job.user_id as string).slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs">{new Date(job.run_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{job.attempts}</td>
                    <td className="px-4 py-3 text-xs">{duration}</td>
                    <td className="px-4 py-3 text-xs text-destructive max-w-[200px] truncate">{job.last_error || "—"}</td>
                    <td className="px-4 py-3">
                      {job.status === "failed" && (
                        <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => handleRetry(job.id)}>
                          <RefreshCw className="mr-1 h-3 w-3" />Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
