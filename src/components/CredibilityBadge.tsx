import { cn } from "@/lib/utils";

interface CredibilityBadgeProps {
  score: number | null;
  compact?: boolean;
  className?: string;
}

export function CredibilityBadge({ score, compact = false, className }: CredibilityBadgeProps) {
  const s = score ?? 85;
  
  const config = s >= 80
    ? { label: "High", color: "text-success", bg: "bg-success/10 border-success/20" }
    : s >= 60
    ? { label: "Moderate", color: "text-warning", bg: "bg-warning/10 border-warning/20" }
    : { label: "Low", color: "text-muted-foreground", bg: "bg-muted border-border" };

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", config.bg, config.color, className)}>
        {s}/100
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", config.bg, config.color, className)}>
      <span>{s}/100</span>
      <span className="opacity-70">credibility</span>
    </div>
  );
}
