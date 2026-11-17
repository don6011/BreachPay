import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PartnerRoute } from "@/components/PartnerRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PartnerLayout } from "@/layouts/PartnerLayout";
import Landing from "./pages/Landing";
import Directory from "./pages/Directory";
import SettlementPublic from "./pages/SettlementPublic";
import BreachCompany from "./pages/BreachCompany";
import Pricing from "./pages/Pricing";
import Help from "./pages/Help";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import { EmailConfirm, EmailUnsubscribe } from "./pages/EmailAction";
import { seedQueryClient } from "@/lib/settlements/data";
import { DIRECTORY_PATH } from "@/lib/settlements/format";
import { FEATURES } from "@/config/features";
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scan = lazy(() => import("./pages/Scan"));
const Settlements = lazy(() => import("./pages/Settlements"));
const SettlementDetail = lazy(() => import("./pages/SettlementDetail"));
const Claims = lazy(() => import("./pages/Claims"));
const ClaimFiling = lazy(() => import("./pages/ClaimFiling"));
const ClaimTracker = lazy(() => import("./pages/ClaimTracker"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const Settings = lazy(() => import("./pages/Settings"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Payouts = lazy(() => import("./pages/Payouts"));
const Vault = lazy(() => import("./pages/Vault"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettlements = lazy(() => import("./pages/admin/AdminSettlements"));
const AdminClaims = lazy(() => import("./pages/admin/AdminClaims"));
const AdminActivityLogs = lazy(() => import("./pages/admin/AdminActivityLogs"));
const AdminAutomationLogs = lazy(() => import("./pages/admin/AdminAutomationLogs"));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts"));
const AdminPartners = lazy(() => import("./pages/admin/AdminPartners"));
const AdminBreachCatalog = lazy(() => import("./pages/admin/AdminBreachCatalog"));
const AdminCron = lazy(() => import("./pages/admin/AdminCron"));
const AdminDocuments = lazy(() => import("./pages/admin/AdminDocuments"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminInvoices = lazy(() => import("./pages/admin/AdminInvoices"));
const AdminOpsConsole = lazy(() => import("./pages/admin/AdminOpsConsole"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerClaims = lazy(() => import("./pages/partner/PartnerClaims"));
const PartnerClaimDetail = lazy(() => import("./pages/partner/PartnerClaimDetail"));
const PartnerReporting = lazy(() => import("./pages/partner/PartnerReporting"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings"));
const PartnerIntake = lazy(() => import("./pages/partner/PartnerIntake"));
const PartnerRevenue = lazy(() => import("./pages/partner/PartnerRevenue"));
const PartnerIntegrations = lazy(() => import("./pages/partner/PartnerIntegrations"));
const PartnerApiAccess = lazy(() => import("./pages/partner/PartnerApiAccess"));
const PartnerSLA = lazy(() => import("./pages/partner/PartnerSLA"));
const Support = lazy(() => import("./pages/Support"));
const ShareClaim = lazy(() => import("./pages/ShareClaim"));
const CheckEligibility = lazy(() => import("./pages/CheckEligibility"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient();
// Pre-rendered pages embed their data, so the first render needs no request.
if (typeof window !== "undefined") seedQueryClient(queryClient, window.__BREACHPAY_DATA__);

// Screens behind a switched-off feature send people back to the dashboard.
const home = <Navigate to="/dashboard" replace />;

// Shown while a route's code chunk is being fetched.
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path={DIRECTORY_PATH} element={<Directory />} />
            <Route path="/help" element={<Help />} />
            <Route path="/email/confirm" element={<EmailConfirm />} />
            <Route path="/email/unsubscribe" element={<EmailUnsubscribe />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* User App - Protected */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/settlements/:id" element={<SettlementDetail />} />
              <Route path="/claims" element={<Claims />} />
              <Route path="/claims/file" element={FEATURES.claimPackets ? <ClaimFiling /> : <Navigate to="/settlements" replace />} />
              <Route path="/claims/:claimId" element={FEATURES.claimPackets ? <ClaimTracker /> : <Navigate to="/claims" replace />} />
              <Route path="/monitoring" element={FEATURES.scheduledScans ? <Monitoring /> : home} />
              <Route path="/wallet" element={FEATURES.payouts ? <Wallet /> : home} />
              <Route path="/payouts" element={FEATURES.payouts ? <Payouts /> : home} />
              <Route path="/vault" element={FEATURES.documentUploads ? <Vault /> : home} />
              <Route path="/support" element={FEATURES.aiSupport ? <Support /> : <Navigate to="/help" replace />} />
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
              <Route path="/admin/ops" element={<AdminOpsConsole />} />
            </Route>

            {/* Partner Portal - Protected */}
            <Route element={<PartnerRoute><PartnerLayout /></PartnerRoute>}>
              <Route path="/partner" element={<PartnerDashboard />} />
              <Route path="/partner/claims" element={<PartnerClaims />} />
              <Route path="/partner/claims/:id" element={<PartnerClaimDetail />} />
              <Route path="/partner/reporting" element={<PartnerReporting />} />
              <Route path="/partner/intake" element={<PartnerIntake />} />
              <Route path="/partner/revenue" element={<PartnerRevenue />} />
              <Route path="/partner/integrations" element={<PartnerIntegrations />} />
              <Route path="/partner/api" element={<PartnerApiAccess />} />
              <Route path="/partner/sla" element={<PartnerSLA />} />
              <Route path="/partner/settings" element={<PartnerSettings />} />
            </Route>

            {/* Public share page */}
            <Route path="/share/claim" element={<ShareClaim />} />

            {/* Public SEO pages */}
            <Route path="/settlement/:slug" element={<SettlementPublic />} />
            <Route path="/breach/:company" element={<BreachCompany />} />
            <Route path="/check/:slug" element={<CheckEligibility />} />

            {/* Legal pages */}
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
