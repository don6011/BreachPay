import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Bell, RefreshCw, RotateCcw, Trash2, Send, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  sending: "bg-primary/10 text-primary border-primary/30",
  sent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  sending: <Loader2 className="h-3 w-3 animate-spin" />,
  sent: <CheckCircle className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
};

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  in_app: <Bell className="h-3.5 w-3.5" />,
};

export default function AdminNotifications() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["admin-outbox", statusFilter, templateFilter, channelFilter],
    queryFn: async () => {
      let q = supabase
        .from("notification_outbox")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (templateFilter !== "all") q = q.eq("template", templateFilter);
      if (channelFilter !== "all") q = q.eq("channel", channelFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_outbox")
        .update({ status: "pending", last_error: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-outbox"] });
      toast({ title: "Re-queued for delivery" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_outbox").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-outbox"] });
      toast({ title: "Notification deleted" });
    },
  });

  const triggerDispatch = async () => {
    try {
      const { error } = await supabase.functions.invoke("dispatch-outbox");
      if (error) throw error;
      toast({ title: "Dispatch triggered" });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Compute stats
  const stats = {
    pending: rows?.filter((r) => r.status === "pending").length ?? 0,
    sent: rows?.filter((r) => r.status === "sent").length ?? 0,
    failed: rows?.filter((r) => r.status === "failed").length ?? 0,
    total: rows?.length ?? 0,
  };

  return (
    <div>
      <PageHeader title="Notification Outbox" subtitle="Browse and manage queued notifications" />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Pending", value: stats.pending, color: "text-warning" },
          { label: "Sent", value: stats.sent, color: "text-emerald-400" },
          { label: "Failed", value: stats.failed, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + actions */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            <SelectItem value="new_match">new_match</SelectItem>
            <SelectItem value="deadline_soon">deadline_soon</SelectItem>
            <SelectItem value="scan_complete">scan_complete</SelectItem>
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36 rounded-xl">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="in_app">in_app</SelectItem>
            <SelectItem value="email">email</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" className="rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>

        <Button className="rounded-xl ml-auto" onClick={triggerDispatch}>
          <Send className="mr-2 h-4 w-4" />Dispatch Now
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Sent At</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : !rows?.length ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No notifications found</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={statusColors[row.status] || ""}>
                      <span className="flex items-center gap-1.5">{statusIcons[row.status]} {row.status}</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs">
                      {channelIcons[row.channel] || null}
                      {row.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.template}</code>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{(row.user_id as string).slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-center">{row.attempts}</td>
                  <td className="px-4 py-3 text-xs text-destructive max-w-[180px] truncate" title={row.last_error || ""}>
                    {row.last_error || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {row.status === "failed" && (
                        <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2" onClick={() => retryMutation.mutate(row.id)}>
                          <RotateCcw className="mr-1 h-3 w-3" />Retry
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="rounded-lg text-xs h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(row.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
