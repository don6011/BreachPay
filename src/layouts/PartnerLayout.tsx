import { Outlet } from "react-router-dom";
import { PartnerSidebar } from "@/components/PartnerSidebar";

export function PartnerLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <PartnerSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
