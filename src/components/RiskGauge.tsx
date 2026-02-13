import { cn } from "@/lib/utils";

interface RiskGaugeProps {
  score: number; // 0-100
  maxScore?: number;
  className?: string;
}

function getSeverity(score: number) {
  if (score >= 80) return { label: "Severe", color: "hsl(0, 72%, 51%)" };
  if (score >= 60) return { label: "High", color: "hsl(38, 92%, 50%)" };
  if (score >= 40) return { label: "Medium", color: "hsl(38, 92%, 50%)" };
  if (score >= 20) return { label: "Low", color: "hsl(152, 69%, 45%)" };
  return { label: "Minimal", color: "hsl(164, 100%, 42%)" };
}

export function RiskGauge({ score, maxScore = 100, className }: RiskGaugeProps) {
  const { label, color } = getSeverity(score);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / maxScore) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="hsl(220, 14%, 16%)" strokeWidth="10" />
          <circle
            cx="80" cy="80" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 80 80)"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/ {maxScore}</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        <p className="text-xs text-muted-foreground">IdentityRisk™ Index</p>
      </div>
    </div>
  );
}
