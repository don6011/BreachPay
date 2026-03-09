import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Users, Copy, Check, X, Share2 } from "lucide-react";
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

  const handleShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check if you're owed money from data breaches",
          text: "I found settlement opportunities with BreachPay. You might be eligible too.",
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  if (!referralCode) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Know someone affected by a data breach?</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Invite them to run a BreachPay scan. If they discover a claim opportunity, you earn{" "}
        <span className="text-primary font-semibold">$5</span>.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted/50 rounded-xl px-3 py-2.5 truncate border border-border">{shareUrl}</code>
        <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <Button className="rounded-xl w-full" onClick={handleShare}>
        <Share2 className="mr-2 h-4 w-4" /> Invite Friends
      </Button>
    </div>
  );
}
