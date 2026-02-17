import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeadlineBadgeProps {
  deadline: string | null;
  className?: string;
}

export function getDeadlineDays(deadline: string | null): number {
  if (!deadline) return Infinity;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

export function DeadlineBadge({ deadline, className }: DeadlineBadgeProps) {
  const days = getDeadlineDays(deadline);

  if (!deadline || days > 30) return null;

  if (days <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground", className)}>
        <XCircle className="h-2.5 w-2.5" /> Deadline Passed
      </span>
    );
  }

  if (days <= 7) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border border-critical/20 bg-critical/10 px-2 py-0.5 text-[10px] font-semibold text-critical animate-pulse", className)}>
        <AlertTriangle className="h-2.5 w-2.5" /> Urgent — {days}d left
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning", className)}>
      <Clock className="h-2.5 w-2.5" /> Deadline Soon — {days}d left
    </span>
  );
}

export function isDeadlinePassed(deadline: string | null): boolean {
  return getDeadlineDays(deadline) <= 0;
}
