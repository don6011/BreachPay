import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
