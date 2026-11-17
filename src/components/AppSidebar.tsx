import { LayoutDashboard, Search, Scale, FileText, Shield, Settings, LogOut, ShieldAlert, Wallet, FolderLock, Banknote, Headphones, Handshake, ListChecks } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURES } from "@/config/features";
import { DIRECTORY_PATH } from "@/lib/settlements/format";

const userNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, show: true },
  { title: "Breach check", url: "/scan", icon: Search, show: true },
  { title: "My matches", url: "/settlements", icon: Scale, show: true },
  { title: "My claims", url: "/claims", icon: FileText, show: true },
  { title: "All settlements", url: DIRECTORY_PATH, icon: ListChecks, show: true },
  { title: "Monitoring", url: "/monitoring", icon: Shield, show: FEATURES.scheduledScans },
  { title: "Wallet", url: "/wallet", icon: Wallet, show: FEATURES.payouts },
  { title: "Payouts", url: "/payouts", icon: Banknote, show: FEATURES.payouts },
  { title: "Evidence Vault", url: "/vault", icon: FolderLock, show: FEATURES.documentUploads },
  FEATURES.aiSupport
    ? { title: "Support", url: "/support", icon: Headphones, show: true }
    : { title: "Help", url: "/help", icon: Headphones, show: true },
  { title: "Settings", url: "/settings", icon: Settings, show: true },
].filter((item) => item.show);

const itemClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-primary/10 text-primary"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  );

/** Navigation for the signed-in app. `onNavigate` lets the mobile menu close itself. */
export function AppSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut, isAdmin, isPartner } = useAuth();

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link to="/dashboard" onClick={onNavigate} aria-label="BreachPay dashboard">
          <img src="/logo.png" alt="BreachPay" width={109} height={36} className="h-9 w-auto" />
        </Link>
      </div>

      <nav aria-label="App" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {userNav.map((item) => (
          <NavLink key={item.url} to={item.url} onClick={onNavigate} className={itemClass(location.pathname === item.url)}>
            <item.icon className="h-4 w-4" aria-hidden />
            {item.title}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        {isPartner && (
          <NavLink to="/partner" onClick={onNavigate} className={itemClass(location.pathname.startsWith("/partner"))}>
            <Handshake className="h-4 w-4" aria-hidden />
            Partner Portal
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin/analytics" onClick={onNavigate} className={itemClass(location.pathname.startsWith("/admin"))}>
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Admin Portal
          </NavLink>
        )}
        <button onClick={() => signOut()} className={cn(itemClass(false), "w-full")}>
          <LogOut className="h-4 w-4" aria-hidden />
          Log Out
        </button>
      </div>
    </>
  );
}

/** Fixed sidebar for large screens; smaller screens use the menu in AppLayout. */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <AppSidebarContent />
    </aside>
  );
}
