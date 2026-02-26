import { Shield, Eye, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettlementStatusBadgeProps {
  status: string;
  compact?: boolean;
  className?: string;
}

const configs: Record<string, { icon: React.ElementType; label: string; bg: string; color: string }> = {
  verified: { icon: Shield, label: "Verified Settlement", bg: "bg-success/10 border-success/20", color: "text-success" },
  monitored: { icon: Eye, label: "Monitored", bg: "bg-info/10 border-info/20", color: "text-info" },
  pending: { icon: Clock, label: "Pending", bg: "bg-warning/10 border-warning/20", color: "text-warning" },
};

export function SettlementStatusBadge({ status, compact = false, className }: SettlementStatusBadgeProps) {
  const config = configs[status] || configs.verified;
  const Icon = config.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-semibold",
      compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      config.bg, config.color, className
    )}>
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
      {config.label}
    </span>
  );
}
