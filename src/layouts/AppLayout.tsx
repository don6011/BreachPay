import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import { AppSidebar, AppSidebarContent } from "@/components/AppSidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PageTransition } from "@/components/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    navigate("/dashboard");
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones and tablets: top bar with a slide-out menu instead of the fixed sidebar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <img src="/logo.png" alt="BreachPay" width={97} height={32} className="h-8 w-auto" />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="flex w-64 flex-col bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <AppSidebarContent onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
