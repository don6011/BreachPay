import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface PayoutRangeProps {
  min: number;
  max: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function fmt(n: number) {
  return n >= 1000 ? `$${n.toLocaleString()}` : `$${n}`;
}

export function PayoutRange({ min, max, className, size = "md" }: PayoutRangeProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  };

  let label: string;
  if (min > 0 && max > 0 && min !== max) {
    label = `${fmt(min)} – ${fmt(max)}`;
  } else if (min > 0 && (max === 0 || min === max)) {
    label = `Up to ${fmt(min)}`;
  } else if (max > 0) {
    label = `Up to ${fmt(max)}`;
  } else {
    label = "TBD";
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <DollarSign className="h-4 w-4 text-primary" />
      <span className={cn("font-bold gradient-emerald-text", sizeClasses[size])}>
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground ml-1">estimated compensation</span>
    </div>
  );
}
