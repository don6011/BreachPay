import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BreachCatalogEntry {
  id: string;
  name: string;
  company: string;
  breach_year: number | null;
  severity: string;
  exposed_fields: string;
  data_types: string[];
  records_exposed: number | null;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  verified: boolean;
  verification_status: string;
  tags: string[];
  active: boolean;
  settlement_available: boolean;
  settlement_name: string | null;
  estimated_payout_min: number | null;
  estimated_payout_max: number | null;
  claim_deadline: string | null;
  law_firm_partner: string | null;
  created_at: string;
  updated_at: string;
}

export function useAllBreaches() {
  return useQuery({
    queryKey: ["breach-catalog", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breach_catalog")
        .select("*")
        .order("breach_year", { ascending: false });
      if (error) throw error;
      return (data || []) as BreachCatalogEntry[];
    },
  });
}

export function useActiveSettlements() {
  return useQuery({
    queryKey: ["breach-catalog", "active-settlements"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("breach_catalog")
        .select("*")
        .eq("settlement_available", true)
        .eq("active", true)
        .eq("verified", true)
        .gte("claim_deadline", today)
        .order("claim_deadline", { ascending: true });
      if (error) throw error;
      return (data || []) as BreachCatalogEntry[];
    },
  });
}

export function useBreachesBySeverity(severity: string) {
  return useQuery({
    queryKey: ["breach-catalog", "severity", severity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breach_catalog")
        .select("*")
        .eq("severity", severity)
        .eq("active", true)
        .order("breach_year", { ascending: false });
      if (error) throw error;
      return (data || []) as BreachCatalogEntry[];
    },
    enabled: !!severity,
  });
}

export function useRecentVerifiedBreaches(limit = 10) {
  return useQuery({
    queryKey: ["breach-catalog", "recent-verified", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breach_catalog")
        .select("*")
        .eq("active", true)
        .eq("verified", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as BreachCatalogEntry[];
    },
  });
}
