import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "teal";
  className?: string;
}

export function StatCard({ icon: Icon, label, value, subtitle, variant = "default", className }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-5 transition-all",
      variant === "teal" && "border-primary/30 shadow-[0_0_15px_0_hsl(164_100%_42%/0.08)]",
      className
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          variant === "teal" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
