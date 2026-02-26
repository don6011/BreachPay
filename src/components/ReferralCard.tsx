import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Users, Copy, Check, Gift } from "lucide-react";

export function ReferralCard() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("referral_code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.referral_code) {
        setReferralCode(profile.referral_code);
      }

      const { data: refs } = await supabase
        .from("user_referrals")
        .select("status, reward_amount")
        .eq("referrer_user_id", user.id);

      if (refs) {
        setReferralCount(refs.filter((r: any) => r.status !== "pending").length);
        setTotalEarned(
          refs
            .filter((r: any) => r.status === "paid")
            .reduce((sum: number, r: any) => sum + (Number(r.reward_amount) || 0), 0)
        );
      }
    };
    fetch();
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
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Share BreachPay</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Know someone affected? They could be owed money too. Earn <span className="text-primary font-medium">$5</span> for each friend who submits a claim.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate">{shareUrl}</code>
        <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {(referralCount > 0 || totalEarned > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{referralCount} referral{referralCount !== 1 ? "s" : ""}</span>
          </div>
          {totalEarned > 0 && (
            <div className="flex items-center gap-1">
              <Gift className="h-3 w-3 text-primary" />
              <span className="text-primary">${totalEarned} earned</span>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Capped at $100. Reward paid when your referral submits a claim.
      </p>
    </div>
  );
}
