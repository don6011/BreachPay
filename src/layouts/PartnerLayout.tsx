import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PartnerSidebar } from "@/components/PartnerSidebar";
import { PageTransition } from "@/components/PageTransition";

export function PartnerLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      <PartnerSidebar />
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
