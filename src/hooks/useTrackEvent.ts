import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type EventName =
  | "scan_started"
  | "scan_completed"
  | "match_created"
  | "match_viewed"
  | "claim_started"
  | "claim_submitted"
  | "doc_uploaded"
  | "packet_generated"
  | "share_link_created"
  | "payout_marked_paid";

export const useTrackEvent = () => {
  const { user } = useAuth();

  const track = useCallback(
    async (event_name: EventName, meta?: Record<string, any>) => {
      if (!user) return;
      try {
        await supabase.from("product_events").insert({
          user_id: user.id,
          event_name,
          meta: meta || {},
        } as any);
      } catch (e) {
        // Fire-and-forget — don't block UX
        console.warn("Event tracking failed:", e);
      }
    },
    [user]
  );

  return track;
};
