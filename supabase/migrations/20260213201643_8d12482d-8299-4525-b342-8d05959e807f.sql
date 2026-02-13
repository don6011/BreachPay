-- ============================================
-- 1) Automation idempotency tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  run_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (job_name, run_key)
);

CREATE TABLE IF NOT EXISTS public.deadline_alerts_sent (
  user_id uuid NOT NULL,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  threshold_days int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, settlement_id, threshold_days)
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_runs_admin_or_service"
ON public.automation_runs FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "deadline_sent_admin_or_service"
ON public.deadline_alerts_sent FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- 2) Claim status change trigger → alerts + admin log
-- ============================================

CREATE OR REPLACE FUNCTION public.on_claim_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.alerts (
      user_id, type, title, body, severity, related_claim_id, related_settlement_id
    ) VALUES (
      NEW.user_id,
      'claim_update',
      'Claim status updated',
      'Your claim status changed to ' || NEW.status::text || '.',
      CASE
        WHEN NEW.status IN ('approved','paid') THEN 'low'::public.risk_level_t
        WHEN NEW.status = 'documentation_required' THEN 'medium'::public.risk_level_t
        WHEN NEW.status = 'rejected' THEN 'high'::public.risk_level_t
        ELSE 'low'::public.risk_level_t
      END,
      NEW.id,
      NEW.settlement_id
    );

    INSERT INTO public.admin_activity_logs (
      admin_user_id, action, entity_type, entity_id, meta
    ) VALUES (
      auth.uid(),
      'Updated claim status',
      'claim',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_claim_status_change ON public.claims;
CREATE TRIGGER trg_claim_status_change
AFTER UPDATE ON public.claims
FOR EACH ROW
EXECUTE FUNCTION public.on_claim_status_change();

-- ============================================
-- 3) Add unique constraint on settlement_matches for upsert
-- ============================================
ALTER TABLE public.settlement_matches
ADD CONSTRAINT settlement_matches_user_settlement_key
UNIQUE (user_id, settlement_id);