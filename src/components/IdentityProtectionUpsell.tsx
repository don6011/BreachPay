import { Shield, CreditCard, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface IdentityProtectionUpsellProps {
  placement: "post_scan" | "post_claim" | "breach_alert" | "dashboard";
  compact?: boolean;
}

const offers = [
  {
    type: "credit_monitoring" as const,
    icon: CreditCard,
    title: "Credit Monitoring",
    description: "Get alerts on credit changes & new accounts",
    partner: "IdentityGuard",
    cta: "Learn More",
  },
  {
    type: "identity_insurance" as const,
    icon: Shield,
    title: "Identity Theft Insurance",
    description: "Up to $1M coverage against identity theft losses",
    partner: "IdentityGuard",
    cta: "Get Protected",
  },
  {
    type: "restoration" as const,
    icon: Lock,
    title: "Identity Restoration",
    description: "Dedicated specialist to restore your identity",
    partner: "IdentityGuard",
    cta: "Learn More",
  },
];

export const IdentityProtectionUpsell = ({ placement, compact = false }: IdentityProtectionUpsellProps) => {
  const { user } = useAuth();

  const trackClick = async (upsellType: string, partnerName: string) => {
    if (!user) return;
    try {
      await supabase.from("upsell_clicks").insert({
        user_id: user.id,
        upsell_type: upsellType,
        partner_name: partnerName,
        placement,
      } as any);
    } catch {}
  };

  if (compact) {
    const offer = offers[0];
    return (
      <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Protect Your Identity</p>
            <p className="text-xs text-muted-foreground truncate">Credit monitoring & theft insurance</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl shrink-0"
          onClick={() => trackClick(offer.type, offer.partner)}
        >
          Learn More <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold">Identity Protection</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Your data was exposed. Consider ongoing protection from our trusted partners.
      </p>

      <div className="space-y-3">
        {offers.map(({ type, icon: Icon, title, description, partner, cta }) => (
          <div key={type} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Icon className="h-4 w-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl shrink-0 ml-3"
              onClick={() => trackClick(type, partner)}
            >
              {cta}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Partner offers · BreachPay may earn a referral fee · You're never required to purchase
      </p>
    </div>
  );
};
