import { Zap, FileCheck, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

interface ClaimAccelerationCardProps {
  claimId: string;
  estPayout?: number;
}

const services = [
  {
    type: "expedited_review",
    icon: Zap,
    title: "Expedited Review",
    description: "Priority processing — reviewed within 48 hours",
    price: 9,
  },
  {
    type: "doc_verification",
    icon: FileCheck,
    title: "Document Verification",
    description: "Expert review of your supporting documents",
    price: 14,
  },
  {
    type: "eligibility_appeal",
    icon: ShieldCheck,
    title: "Eligibility Appeal",
    description: "Professional appeal if initially denied",
    price: 29,
  },
];

export const ClaimAccelerationCard = ({ claimId, estPayout }: ClaimAccelerationCardProps) => {
  const { user } = useAuth();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchase = async (serviceType: string, amount: number) => {
    if (!user) return;
    setPurchasing(serviceType);
    try {
      const { error } = await supabase.from("claim_services").insert({
        claim_id: claimId,
        user_id: user.id,
        service_type: serviceType,
        amount,
        status: "pending",
      } as any);

      if (error) throw error;

      toast({
        title: "Service Added",
        description: "Claim acceleration service has been added. Payment processing coming soon.",
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to add service.", variant: "destructive" });
    } finally {
      setPurchasing(null);
    }
  };

  // Only show if estimated payout justifies the service cost
  if (estPayout && estPayout < 25) return null;

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Optional Claim Assistance</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Optional services to help prepare and review your claim documentation. These services do not affect settlement administrator processing times.</p>

      <div className="space-y-3">
        {services.map(({ type, icon: Icon, title, description, price }) => (
          <div key={type} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
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
              disabled={purchasing === type}
              onClick={() => handlePurchase(type, price)}
            >
              ${price}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        One-time fees · Only charged if you opt in · Claims are always free to file
      </p>
    </div>
  );
};
