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
      "p-6 transition-all duration-300",
      variant === "teal" ? "glass-card-glow" : "glass-card",
      className
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          variant === "teal" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
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
