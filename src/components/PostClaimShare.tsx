import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Users, Copy, Check, X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  onDismiss: () => void;
}

export function PostClaimShare({ onDismiss }: Props) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("referral_code")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.referral_code) setReferralCode(data.referral_code);
      });
  }, [user]);

  const shareUrl = referralCode
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Referral link copied" });
  };

  if (!referralCode) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Others may also be eligible</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Share BreachPay with someone who was affected. Earn $5 for each friend who submits a claim.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate">{shareUrl}</code>
        <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
