import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Settlements from "./pages/Settlements";
import Claims from "./pages/Claims";
import ClaimFiling from "./pages/ClaimFiling";
import ClaimTracker from "./pages/ClaimTracker";
import Monitoring from "./pages/Monitoring";
import Settings from "./pages/Settings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettlements from "./pages/admin/AdminSettlements";
import AdminClaims from "./pages/admin/AdminClaims";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AdminAutomationLogs from "./pages/admin/AdminAutomationLogs";
import AdminPayouts from "./pages/admin/AdminPayouts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
              <Route path="/claims" element={<Claims />} />
              <Route path="/claims/file" element={<ClaimFiling />} />
              <Route path="/claims/:claimId" element={<ClaimTracker />} />
              <Route path="/monitoring" element={<Monitoring />} />
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
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
