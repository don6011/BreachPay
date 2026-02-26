import { LayoutDashboard, Search, Scale, FileText, Shield, Settings, LogOut, ShieldAlert, Wallet, FolderLock, Banknote, Headphones } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const userNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Scan", url: "/scan", icon: Search },
  { title: "Settlements", url: "/settlements", icon: Scale },
  { title: "Claims", url: "/claims", icon: FileText },
  { title: "Monitoring", url: "/monitoring", icon: Shield },
  { title: "Wallet", url: "/wallet", icon: Wallet },
  { title: "Payouts", url: "/payouts", icon: Banknote },
  { title: "Evidence Vault", url: "/vault", icon: FolderLock },
  { title: "Support", url: "/support", icon: Headphones },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <img src={logo} alt="BreachPay" className="h-9" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {userNav.map((item) => {
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

      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        {isAdmin && (
          <NavLink
            to="/admin/analytics"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname.startsWith("/admin")
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <ShieldAlert className="h-4 w-4" />
            Admin Portal
          </NavLink>
        )}
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
