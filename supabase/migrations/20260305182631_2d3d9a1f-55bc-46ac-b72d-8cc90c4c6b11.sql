
-- 1) Add missing columns to settlements
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- 2) Add missing columns to settlement_raw_ingest
ALTER TABLE public.settlement_raw_ingest
  ADD COLUMN IF NOT EXISTS raw_html text,
  ADD COLUMN IF NOT EXISTS normalized jsonb,
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_ingest_fingerprint ON public.settlement_raw_ingest(fingerprint) WHERE fingerprint IS NOT NULL;

-- 3) Add columns to settlement_sources
ALTER TABLE public.settlement_sources
  ADD COLUMN IF NOT EXISTS parser_type text DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS refresh_frequency text DEFAULT 'daily';

-- 4) Create settlement_verification_checks table
CREATE TABLE IF NOT EXISTS public.settlement_verification_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  pass boolean NOT NULL DEFAULT false,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_verification_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_admin_all" ON public.settlement_verification_checks
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "svc_user_read" ON public.settlement_verification_checks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM settlements s
    WHERE s.id = settlement_verification_checks.settlement_id
      AND s.status = 'verified' AND s.is_demo = false AND s.is_test = false
  ));

-- 5) Validation trigger for settlement_raw_ingest.status
CREATE OR REPLACE FUNCTION trg_validate_raw_ingest_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('new','parsed','queued','rejected') THEN
    RAISE EXCEPTION 'Invalid raw_ingest status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_raw_ingest_status ON public.settlement_raw_ingest;
CREATE TRIGGER trg_raw_ingest_status
  BEFORE INSERT OR UPDATE ON public.settlement_raw_ingest
  FOR EACH ROW EXECUTE FUNCTION trg_validate_raw_ingest_status();

-- 6) Admin verify settlement RPC
CREATE OR REPLACE FUNCTION public.rpc_admin_verify_settlement(
  p_settlement_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checks_passed int;
  v_score int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject';
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE settlements SET
      status = 'rejected',
      verification_status = 'rejected',
      verification_notes = COALESCE(p_notes, verification_notes),
      updated_at = now()
    WHERE id = p_settlement_id;
    RETURN;
  END IF;

  -- Count passing verification checks
  SELECT count(*) INTO v_checks_passed
  FROM settlement_verification_checks
  WHERE settlement_id = p_settlement_id AND pass = true;

  IF v_checks_passed < 1 THEN
    RAISE EXCEPTION 'At least 1 verification check must pass before approval';
  END IF;

  -- Compute credibility score (0-100)
  v_score := LEAST(100, v_checks_passed * 25 + 25);

  -- Check if claim_deadline or payout info exists
  IF EXISTS (SELECT 1 FROM settlements WHERE id = p_settlement_id AND claim_deadline IS NOT NULL) THEN
    v_score := v_score + 10;
  END IF;
  IF EXISTS (SELECT 1 FROM settlements WHERE id = p_settlement_id AND payout_min IS NOT NULL) THEN
    v_score := v_score + 10;
  END IF;
  IF EXISTS (SELECT 1 FROM settlements WHERE id = p_settlement_id AND claim_url IS NOT NULL) THEN
    v_score := v_score + 5;
  END IF;

  v_score := LEAST(100, v_score);

  UPDATE settlements SET
    status = 'verified',
    verified = true,
    verification_status = 'verified',
    verification_level = CASE
      WHEN v_checks_passed >= 3 THEN 'administrator_confirmed'
      WHEN v_checks_passed >= 2 THEN 'court_verified'
      ELSE 'source_linked'
    END,
    credibility_score = v_score,
    last_verified_at = now(),
    verification_notes = COALESCE(p_notes, verification_notes),
    is_demo = false,
    is_test = false,
    updated_at = now()
  WHERE id = p_settlement_id;
END;
$$;

-- 7) Auto-archive expired settlements function
CREATE OR REPLACE FUNCTION public.auto_archive_expired_settlements()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE settlements
  SET status = 'expired', updated_at = now()
  WHERE status IN ('verified','open')
    AND claim_deadline IS NOT NULL
    AND claim_deadline::date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
