import { forwardRef } from "react";
import { motion } from "framer-motion";
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

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(({ icon: Icon, label, value, subtitle, variant = "default", className }, ref) => {
  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "p-6 transition-all duration-300 group cursor-default",
        variant === "teal" ? "glass-card-glow" : "glass-card",
        className
      )}
      ref={ref as any}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
          variant === "teal"
            ? "bg-primary/10 text-primary group-hover:bg-primary/15 group-hover:shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
            : "bg-muted text-muted-foreground group-hover:bg-muted/80"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </motion.div>
  );
});
StatCard.displayName = "StatCard";
