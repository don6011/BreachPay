
-- Fix: recreate view with security_invoker = true (not security definer)
DROP VIEW IF EXISTS public.v_active_settlements;
CREATE VIEW public.v_active_settlements
WITH (security_invoker = true)
AS
SELECT *
FROM public.settlements
WHERE status = 'verified'
  AND is_demo = false
  AND is_test = false
  AND lifecycle_status = 'active'
  AND (claim_deadline IS NULL OR claim_deadline::date >= CURRENT_DATE);

-- Fix search_path on trigger functions
CREATE OR REPLACE FUNCTION public.trg_validate_settlement_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.lifecycle_status NOT IN ('active','closed','archived') THEN
    RAISE EXCEPTION 'Invalid lifecycle_status: %', NEW.lifecycle_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_block_claim_expired_settlement()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_deadline date;
  v_lifecycle text;
BEGIN
  SELECT claim_deadline::date, lifecycle_status
  INTO v_deadline, v_lifecycle
  FROM public.settlements
  WHERE id = NEW.settlement_id;

  IF v_lifecycle IN ('closed','archived') THEN
    RAISE EXCEPTION 'Cannot file claim: settlement is closed';
  END IF;

  IF v_deadline IS NOT NULL AND v_deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot file claim: settlement deadline has passed';
  END IF;

  RETURN NEW;
END;
$$;
