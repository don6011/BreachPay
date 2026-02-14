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
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "partner")
        .maybeSingle();

      setIsPartner(!error && !!data);
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isPartner) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
