import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  admin_user_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

const AdminActivityLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from("admin_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setLogs(data as ActivityLog[]);
      setLoading(false);
    };

    fetchLogs();
  }, [user]);

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Admin actions and system events" />

      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No activity logs yet</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 rounded-2xl border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{log.action}</span>
                  {log.entity_type && (
                    <span className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">{log.entity_type}</span>
                  )}
                </div>
                {log.entity_id && (
                  <p className="text-xs text-muted-foreground font-mono">{log.entity_id.slice(0, 12)}</p>
                )}
                {Object.keys(log.meta).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{JSON.stringify(log.meta)}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminActivityLogs;
