import { PageHeader } from "@/components/PageHeader";
import { mockActivityLogs } from "@/data/mockData";
import { formatDistanceToNow } from "date-fns";

const AdminActivityLogs = () => {
  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Admin actions and system events" />

      <div className="space-y-2">
        {mockActivityLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-4 rounded-lg border bg-card p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{log.action}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{log.admin_name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{log.target}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminActivityLogs;
