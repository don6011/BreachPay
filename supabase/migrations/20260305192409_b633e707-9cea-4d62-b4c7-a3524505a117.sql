
-- Add lifecycle fields to settlements
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;

-- Validation trigger for lifecycle_status
CREATE OR REPLACE FUNCTION public.trg_validate_settlement_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lifecycle_status NOT IN ('active','closed','archived') THEN
    RAISE EXCEPTION 'Invalid lifecycle_status: %', NEW.lifecycle_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_settlement_lifecycle ON public.settlements;
CREATE TRIGGER validate_settlement_lifecycle
  BEFORE INSERT OR UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_settlement_lifecycle();

-- Create view for active settlements (user-facing canonical filter)
CREATE OR REPLACE VIEW public.v_active_settlements AS
SELECT *
FROM public.settlements
WHERE status = 'verified'
  AND is_demo = false
  AND is_test = false
  AND lifecycle_status = 'active'
  AND (claim_deadline IS NULL OR claim_deadline::date >= CURRENT_DATE);

-- Proc to archive expired settlements
CREATE OR REPLACE FUNCTION public.proc_archive_expired_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE settlements
  SET lifecycle_status = 'closed',
      closed_at = now(),
      updated_at = now()
  WHERE lifecycle_status = 'active'
    AND claim_deadline IS NOT NULL
    AND claim_deadline::date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Server-side claim guard: block claims on expired settlements
CREATE OR REPLACE FUNCTION public.trg_block_claim_expired_settlement()
RETURNS trigger LANGUAGE plpgsql AS $$
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

DROP TRIGGER IF EXISTS block_claim_expired_settlement ON public.claims;
CREATE TRIGGER block_claim_expired_settlement
  BEFORE INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_claim_expired_settlement();
