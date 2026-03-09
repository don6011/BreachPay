import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusPill } from "./StatusPill";
import type { Alert } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface AlertRowProps {
  alert: Alert;
  className?: string;
}

export function AlertRow({ alert, className }: AlertRowProps) {
  return (
    <motion.div
      whileHover={{ x: 4, transition: { duration: 0.15 } }}
      className={cn(
        "flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors cursor-default",
        !alert.read && "border-primary/20 bg-primary/[0.03]",
        className
      )}
    >
      <div className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-300",
        !alert.read ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : "bg-muted-foreground/30"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{alert.title}</span>
          <StatusPill variant={alert.category} />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
      </span>
    </motion.div>
  );
}
