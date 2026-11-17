import { BarChart3, Users, Scale, FileText, Activity, ArrowLeft, Cog, DollarSign, Database, FolderSearch, Timer, Bell, Receipt, LayoutDashboard } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const adminNav = [
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Partners", url: "/admin/partners", icon: Users },
  { title: "Settlements", url: "/admin/settlements", icon: Scale },
  { title: "Claims", url: "/admin/claims", icon: FileText },
  { title: "Payouts", url: "/admin/payouts", icon: DollarSign },
  { title: "Activity Logs", url: "/admin/activity-logs", icon: Activity },
  { title: "Automation Logs", url: "/admin/automation-logs", icon: Cog },
  { title: "Breach Catalog", url: "/admin/breach-catalog", icon: Database },
  { title: "Documents", url: "/admin/documents", icon: FolderSearch },
  { title: "Cron Queue", url: "/admin/cron", icon: Timer },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
  { title: "Invoices", url: "/admin/invoices", icon: Receipt },
  { title: "Ops Console", url: "/admin/ops", icon: LayoutDashboard },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <img src="/logo.png" alt="BreachPay" className="h-9" />
        <span className="ml-auto rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {adminNav.map((item) => {
          const active = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to App
        </NavLink>
      </div>
    </aside>
  );
}
