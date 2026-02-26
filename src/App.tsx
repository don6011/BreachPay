import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PartnerRoute } from "@/components/PartnerRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PartnerLayout } from "@/layouts/PartnerLayout";
import { SplashScreen } from "@/components/SplashScreen";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Settlements from "./pages/Settlements";
import SettlementDetail from "./pages/SettlementDetail";
import Claims from "./pages/Claims";
import ClaimFiling from "./pages/ClaimFiling";
import ClaimTracker from "./pages/ClaimTracker";
import Monitoring from "./pages/Monitoring";
import Settings from "./pages/Settings";
import Wallet from "./pages/Wallet";
import Vault from "./pages/Vault";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettlements from "./pages/admin/AdminSettlements";
import AdminClaims from "./pages/admin/AdminClaims";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AdminAutomationLogs from "./pages/admin/AdminAutomationLogs";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminBreachCatalog from "./pages/admin/AdminBreachCatalog";
import AdminCron from "./pages/admin/AdminCron";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminInvoices from "./pages/admin/AdminInvoices";
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import PartnerClaims from "./pages/partner/PartnerClaims";
import PartnerClaimDetail from "./pages/partner/PartnerClaimDetail";
import PartnerSettings from "./pages/partner/PartnerSettings";
import NotFound from "./pages/NotFound";
import ShareClaim from "./pages/ShareClaim";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pricing" element={<Pricing />} />

            {/* User App - Protected */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/settlements/:id" element={<SettlementDetail />} />
              <Route path="/claims" element={<Claims />} />
              <Route path="/claims/file" element={<ClaimFiling />} />
              <Route path="/claims/:claimId" element={<ClaimTracker />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Admin Portal - Protected */}
            <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/settlements" element={<AdminSettlements />} />
              <Route path="/admin/claims" element={<AdminClaims />} />
              <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
              <Route path="/admin/automation-logs" element={<AdminAutomationLogs />} />
              <Route path="/admin/payouts" element={<AdminPayouts />} />
              <Route path="/admin/partners" element={<AdminPartners />} />
              <Route path="/admin/breach-catalog" element={<AdminBreachCatalog />} />
              <Route path="/admin/cron" element={<AdminCron />} />
              <Route path="/admin/documents" element={<AdminDocuments />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/invoices" element={<AdminInvoices />} />
            </Route>

            {/* Partner Portal - Protected */}
            <Route element={<PartnerRoute><PartnerLayout /></PartnerRoute>}>
              <Route path="/partner" element={<PartnerDashboard />} />
              <Route path="/partner/claims" element={<PartnerClaims />} />
              <Route path="/partner/claims/:id" element={<PartnerClaimDetail />} />
              <Route path="/partner/settings" element={<PartnerSettings />} />
            </Route>

            {/* Public share page */}
            <Route path="/share/claim" element={<ShareClaim />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
