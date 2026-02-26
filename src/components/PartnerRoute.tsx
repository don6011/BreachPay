import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PartnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isPartner, setIsPartner] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkPartner = async () => {
      // Check new partner_users table first, fall back to user_roles
      const { data, error } = await supabase
        .from("partner_users")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setIsPartner(true);
        return;
      }

      // Fallback: check user_roles for legacy partner role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "partner")
        .maybeSingle();

      setIsPartner(!!roleData);
    };

    checkPartner();
  }, [user]);

  if (authLoading || (user && isPartner === null)) {
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
