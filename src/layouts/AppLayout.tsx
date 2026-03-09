import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PageTransition } from "@/components/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        setNeedsOnboarding(false);
        return;
      }

      const { count } = await supabase
        .from("scan_runs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (count && count > 0) {
        await supabase
          .from("user_profiles")
          .update({ onboarding_completed: true })
          .eq("user_id", user.id);
        setNeedsOnboarding(false);
      } else {
        setNeedsOnboarding(true);
      }
    };
    check();
  }, [user]);

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    navigate("/settlements");
  };

  if (needsOnboarding === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
