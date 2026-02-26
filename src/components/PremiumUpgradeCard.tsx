import { Crown, Shield, Zap, Bell, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface PremiumUpgradeCardProps {
  placement?: "post_scan" | "dashboard" | "monitoring" | "breach_alert";
  compact?: boolean;
}

const features = [
  { icon: Zap, text: "Real-time breach monitoring" },
  { icon: Shield, text: "Dark web exposure alerts" },
  { icon: Activity, text: "Identity risk scoring" },
  { icon: Bell, text: "Instant deadline alerts" },
];

export const PremiumUpgradeCard = ({ placement = "dashboard", compact = false }: PremiumUpgradeCardProps) => {
  const { plan } = useAuth();

  if (plan === "premium") return null;

  if (compact) {
    return (
      <div className="glass-card-glow p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Crown className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Upgrade to Premium</p>
            <p className="text-xs text-muted-foreground truncate">Daily scans · Instant alerts · $4.99/mo</p>
          </div>
        </div>
        <Button asChild size="sm" className="rounded-xl shrink-0">
          <Link to="/pricing">Upgrade <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card-glow p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Premium Protection</h3>
          <p className="text-xs text-muted-foreground">Continuous monitoring for peace of mind</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {features.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold">$4.99</span>
        <span className="text-sm text-muted-foreground">/mo</span>
        <span className="ml-2 text-xs text-muted-foreground line-through">$9.99</span>
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">50% OFF</span>
      </div>

      <Button asChild className="w-full rounded-xl">
        <Link to="/pricing">
          <Crown className="mr-2 h-4 w-4" /> Start Premium Trial
        </Link>
      </Button>
      <p className="text-center text-[10px] text-muted-foreground mt-2">Cancel anytime · No commitment</p>
    </div>
  );
};
