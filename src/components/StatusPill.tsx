import { cn } from "@/lib/utils";
import type { SeverityLevel, SettlementStatus, ClaimStatus, AlertCategory } from "@/types";

type PillVariant = SeverityLevel | SettlementStatus | ClaimStatus | AlertCategory | "active" | "inactive";

const variantStyles: Record<string, string> = {
  low: "bg-success/15 text-success border-success/20",
  medium: "bg-warning/15 text-warning border-warning/20",
  high: "bg-critical/15 text-critical border-critical/20",
  critical: "bg-critical/20 text-critical border-critical/30",
  open: "bg-success/15 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  closed: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
  submitted: "bg-info/15 text-primary border-primary/20",
  documentation_required: "bg-warning/15 text-warning border-warning/20",
  under_review: "bg-warning/15 text-warning border-warning/20",
  approved: "bg-success/15 text-success border-success/20",
  rejected: "bg-critical/15 text-critical border-critical/20",
  paid: "bg-success/20 text-success border-success/30",
  active: "bg-success/15 text-success border-success/20",
  inactive: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
  breach_detected: "bg-critical/15 text-critical border-critical/20",
  settlement_found: "bg-primary/15 text-primary border-primary/20",
  payout_update: "bg-success/15 text-success border-success/20",
  claim_update: "bg-info/15 text-primary border-primary/20",
  system: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
};

const labelMap: Record<string, string> = {
  under_review: "Under Review",
  documentation_required: "Docs Required",
  breach_detected: "Breach Detected",
  settlement_found: "Settlement Found",
  payout_update: "Payout Update",
  claim_update: "Claim Update",
};

export function StatusPill({ variant, className }: { variant: PillVariant; className?: string }) {
  const label = labelMap[variant] || variant.charAt(0).toUpperCase() + variant.slice(1);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize", variantStyles[variant] || "bg-muted text-muted-foreground", className)}>
      {label}
    </span>
  );
}
