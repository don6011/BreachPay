import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ScanSchedule {
  id: string;
  user_id: string;
  is_enabled: boolean;
  frequency: string;
  next_run_at: string;
  last_run_at: string | null;
  timezone: string;
  scan_type: string;
  created_at: string;
}

export function useScanSchedule() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scan-schedule", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_schedule" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ScanSchedule | null;
    },
  });
}

export function useUpsertSchedule() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { is_enabled: boolean; frequency: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if schedule exists
      const { data: existing } = await supabase
        .from("scan_schedule" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const nextRun = new Date();
      if (params.frequency === "hourly") nextRun.setHours(nextRun.getHours() + 1);
      else if (params.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else nextRun.setDate(nextRun.getDate() + 7);

      if (existing) {
        const { error } = await supabase
          .from("scan_schedule" as any)
          .update({
            is_enabled: params.is_enabled,
            frequency: params.frequency,
            next_run_at: nextRun.toISOString(),
          } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scan_schedule" as any)
          .insert({
            user_id: user.id,
            is_enabled: params.is_enabled,
            frequency: params.frequency,
            next_run_at: nextRun.toISOString(),
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-schedule"] }),
  });
}

export function useScanJobQueue(statusFilter?: string) {
  return useQuery({
    queryKey: ["scan-job-queue", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("scan_job_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useNotificationOutbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification-outbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_outbox" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("scan_job_queue" as any)
        .update({ status: "queued", last_error: null, started_at: null, finished_at: null } as any)
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-job-queue"] }),
  });
}
