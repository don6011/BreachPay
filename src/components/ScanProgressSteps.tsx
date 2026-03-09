import { useEffect, useState } from "react";
import { Check, Loader2, Database, Shield, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const steps = [
  { icon: Database, label: "Scanning breach databases…", duration: 3000 },
  { icon: Shield, label: "Checking settlement eligibility…", duration: 4000 },
  { icon: DollarSign, label: "Analyzing compensation opportunities…", duration: 5000 },
];

export function ScanProgressSteps() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepTimers: NodeJS.Timeout[] = [];
    let cumulative = 0;

    steps.forEach((step, i) => {
      stepTimers.push(
        setTimeout(() => setActiveStep(i), cumulative)
      );
      cumulative += step.duration;
    });

    return () => stepTimers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        // Slow down as we approach 95
        const increment = Math.max(0.3, (95 - prev) * 0.02);
        return Math.min(95, prev + increment);
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="glass-card-glow p-8 text-center">
        {/* Animated radar pulse */}
        <div className="relative mx-auto mb-8 h-20 w-20">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-2 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">Running Secure Scan</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Analyzing your identity across breach databases
        </p>

        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">{Math.floor(progress)}% complete</p>
        </div>

        {/* Step indicators */}
        <div className="space-y-3 text-left">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = i === activeStep;
            const isComplete = i < activeStep;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl p-3 transition-all duration-500 ${
                  isActive ? "bg-primary/5 border border-primary/20" :
                  isComplete ? "bg-success/5 border border-success/10" :
                  "bg-muted/30 border border-transparent opacity-50"
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isComplete ? "bg-success/10" :
                  isActive ? "bg-primary/10" : "bg-muted"
                }`}>
                  {isComplete ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <StepIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  isComplete ? "text-success" :
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
