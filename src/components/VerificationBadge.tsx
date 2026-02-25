import { AlertTriangle, Link2, Gavel, BadgeCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerificationLevel = "unverified" | "source_linked" | "court_verified" | "administrator_confirmed";

interface VerificationConfig {
  icon: React.ElementType;
  label: string;
  text: string;
  colorClass: string;
  badgeBg: string;
}

const CONFIG: Record<VerificationLevel, VerificationConfig> = {
  unverified: {
    icon: AlertTriangle,
    label: "Unverified",
    text: "Information not yet confirmed from an official source.",
    colorClass: "text-muted-foreground",
    badgeBg: "bg-muted/50 border-border text-muted-foreground",
  },
  source_linked: {
    icon: Link2,
    label: "Source linked",
    text: "Linked to a public or official source.",
    colorClass: "text-primary",
    badgeBg: "bg-primary/10 border-primary/20 text-primary",
  },
  court_verified: {
    icon: Gavel,
    label: "Court verified",
    text: "Verified against court filing documentation.",
    colorClass: "text-primary",
    badgeBg: "bg-primary/15 border-primary/25 text-primary",
  },
  administrator_confirmed: {
    icon: BadgeCheck,
    label: "Administrator confirmed",
    text: "Confirmed with settlement administrator.",
    colorClass: "text-gold drop-shadow-[0_0_6px_hsl(43_52%_54%/0.4)]",
    badgeBg: "badge-gold",
  },
};

interface VerificationBadgeProps {
  level: string;
  verified: boolean;
  sourceUrl?: string | null;
  compact?: boolean;
  className?: string;
}

export function VerificationBadge({ level, verified, sourceUrl, compact = false, className }: VerificationBadgeProps) {
  const config = CONFIG[(level as VerificationLevel)] || CONFIG.unverified;
  const Icon = config.icon;

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", config.badgeBg, className)}>
        <Icon className="h-2.5 w-2.5" />
        {config.label}
        {verified && level !== "unverified" && (
          <span className="ml-0.5 text-[9px] opacity-75">✓</span>
        )}
      </span>
    );
  }

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <div className={cn("mt-0.5 shrink-0", config.colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-semibold", config.colorClass)}>{config.label}</span>
          {verified && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 border border-success/20 px-2 py-0.5 text-[10px] font-semibold text-success">
              Verified
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{config.text}</p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            <ExternalLink className="h-3 w-3" /> View source
          </a>
        )}
      </div>
    </div>
  );
}
