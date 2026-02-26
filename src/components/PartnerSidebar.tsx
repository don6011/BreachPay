import { BarChart3, FileText, Settings, ArrowLeft, TrendingUp, Users, DollarSign, Code2, Key, Clock } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const partnerNav = [
  { title: "Dashboard", url: "/partner", icon: BarChart3 },
  { title: "Cases", url: "/partner/claims", icon: FileText },
  { title: "Intake", url: "/partner/intake", icon: Users },
  { title: "Revenue", url: "/partner/revenue", icon: DollarSign },
  { title: "Reports", url: "/partner/reporting", icon: TrendingUp },
  { title: "Integrations", url: "/partner/integrations", icon: Code2 },
  { title: "API Access", url: "/partner/api", icon: Key },
  { title: "SLA Performance", url: "/partner/sla", icon: Clock },
  { title: "Settings", url: "/partner/settings", icon: Settings },
];

export function PartnerSidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <img src={logo} alt="BreachPay" className="h-9" />
        <span className="ml-auto rounded-lg bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase tracking-wider">Partner</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {partnerNav.map((item) => {
          const active = item.url === "/partner"
            ? location.pathname === "/partner"
            : location.pathname.startsWith(item.url);
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
