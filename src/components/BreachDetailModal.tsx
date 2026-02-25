import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Calendar, DollarSign, ExternalLink, AlertTriangle, Building2, Scale } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { BreachCatalogEntry } from "@/hooks/useBreachCatalog";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};

const VERIFICATION_COLORS: Record<string, string> = {
  verified: "bg-primary/15 text-primary border-primary/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  disputed: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface Props {
  breach: BreachCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BreachDetailModal({ breach, open, onOpenChange }: Props) {
  if (!breach) return null;

  const daysLeft = breach.claim_deadline
    ? differenceInDays(new Date(breach.claim_deadline), new Date())
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
              {breach.company.slice(0, 2).toUpperCase()}
            </div>
            <span>{breach.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`capitalize ${SEVERITY_COLORS[breach.severity] || ""}`}>
              {breach.severity}
            </Badge>
            <Badge variant="outline" className={`capitalize ${VERIFICATION_COLORS[breach.verification_status] || ""}`}>
              {breach.verification_status}
            </Badge>
            {breach.settlement_available && (
              <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">
                <Scale className="h-3 w-3 mr-1" /> Settlement Available
              </Badge>
            )}
          </div>

          {/* Company & Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Building2 className="h-3.5 w-3.5" /> Company
              </div>
              <p className="font-medium">{breach.company}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3.5 w-3.5" /> Breach Year
              </div>
              <p className="font-medium">{breach.breach_year || "Unknown"}</p>
            </div>
          </div>

          {/* Exposed Data */}
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Exposed Data Types
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(breach.data_types?.length ? breach.data_types : breach.exposed_fields.split(",")).map((dt) => (
                <span key={dt.trim()} className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5 border border-destructive/20">
                  {dt.trim()}
                </span>
              ))}
            </div>
            {breach.records_exposed && (
              <p className="mt-2 text-xs text-muted-foreground">
                {breach.records_exposed.toLocaleString()} records exposed
              </p>
            )}
          </div>

          {/* Settlement Info */}
          {breach.settlement_available && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
                <DollarSign className="h-3.5 w-3.5" /> Settlement Details
              </div>
              {breach.settlement_name && (
                <p className="text-sm font-medium">{breach.settlement_name}</p>
              )}
              {(breach.estimated_payout_min != null || breach.estimated_payout_max != null) && (
                <p className="text-lg font-bold gradient-emerald-text">
                  ${(breach.estimated_payout_min || 0).toLocaleString()} – ${(breach.estimated_payout_max || 0).toLocaleString()}
                </p>
              )}
              {breach.claim_deadline && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Deadline: {format(new Date(breach.claim_deadline), "MMM d, yyyy")}</span>
                  {daysLeft != null && daysLeft > 0 && (
                    <Badge variant="outline" className={daysLeft <= 30 ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-primary/15 text-primary border-primary/30"}>
                      {daysLeft}d left
                    </Badge>
                  )}
                  {daysLeft != null && daysLeft <= 0 && (
                    <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">Expired</Badge>
                  )}
                </div>
              )}
              {breach.law_firm_partner && (
                <p className="text-xs text-muted-foreground">Partner: {breach.law_firm_partner}</p>
              )}
            </div>
          )}

          {/* Source */}
          {breach.source_url && (
            <Button variant="outline" size="sm" className="rounded-xl w-full" asChild>
              <a href={breach.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> View Source Documentation
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
