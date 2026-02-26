import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const PartnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isPartner } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isPartner) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
