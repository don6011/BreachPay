import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";

export function AdminLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
