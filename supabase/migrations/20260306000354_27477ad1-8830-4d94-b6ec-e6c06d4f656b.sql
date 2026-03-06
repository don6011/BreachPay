
-- 1) Add eligibility_rules to settlements
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS eligibility_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Add eligibility + anti-spam fields to claims
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS eligibility_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligibility_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submit_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

-- 3) claim_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id),
  attempt_type text NOT NULL DEFAULT 'start' CHECK (attempt_type IN ('start','submit')),
  success boolean NOT NULL DEFAULT false,
  blocked_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_attempts_owner_select" ON public.claim_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "claim_attempts_owner_insert" ON public.claim_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "claim_attempts_admin_all" ON public.claim_attempts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_claim_attempts_user_created ON public.claim_attempts(user_id, created_at);

-- 4) user_risk_flags table
CREATE TABLE IF NOT EXISTS public.user_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  locked_until timestamptz NULL,
  lock_reason text NULL,
  total_lockouts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "urf_owner_select" ON public.user_risk_flags
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "urf_admin_all" ON public.user_risk_flags
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5) rpc_can_start_claim: checks eligibility without side effects
CREATE OR REPLACE FUNCTION public.rpc_can_start_claim(p_settlement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settlement record;
  v_locked_until timestamptz;
  v_starts_24h int;
  v_min_confidence int;
  v_match_confidence int;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not authenticated');
  END IF;

  -- Check lockout
  SELECT locked_until INTO v_locked_until
  FROM user_risk_flags WHERE user_id = v_user_id;
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Account temporarily locked due to excessive attempts. Try again later.');
  END IF;

  -- Check settlement is active
  SELECT id, status, lifecycle_status, claim_deadline, is_demo, is_test, eligibility_rules
  INTO v_settlement
  FROM settlements
  WHERE id = p_settlement_id;

  IF v_settlement IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement not found');
  END IF;
  IF v_settlement.is_demo OR v_settlement.is_test THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement not available');
  END IF;
  IF v_settlement.status != 'verified' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement not yet verified');
  END IF;
  IF v_settlement.lifecycle_status != 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement is closed');
  END IF;
  IF v_settlement.claim_deadline IS NOT NULL AND v_settlement.claim_deadline::date < CURRENT_DATE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement deadline has passed');
  END IF;

  -- Rate limit: >5 starts in 24h
  SELECT count(*) INTO v_starts_24h
  FROM claim_attempts
  WHERE user_id = v_user_id AND attempt_type = 'start' AND created_at > now() - interval '24 hours';

  IF v_starts_24h >= 5 THEN
    -- Auto-lock
    INSERT INTO user_risk_flags (user_id, locked_until, lock_reason, total_lockouts)
    VALUES (v_user_id, now() + interval '24 hours', 'Excessive claim start attempts', 1)
    ON CONFLICT (user_id) DO UPDATE SET
      locked_until = now() + interval '24 hours',
      lock_reason = 'Excessive claim start attempts',
      total_lockouts = user_risk_flags.total_lockouts + 1,
      updated_at = now();
    RETURN jsonb_build_object('allowed', false, 'reason', 'Too many claim attempts. Account locked for 24 hours.');
  END IF;

  -- Check match confidence
  v_min_confidence := COALESCE((v_settlement.eligibility_rules->>'min_confidence')::int, 65);
  SELECT confidence_score INTO v_match_confidence
  FROM settlement_matches
  WHERE user_id = v_user_id AND settlement_id = p_settlement_id
  ORDER BY confidence_score DESC LIMIT 1;

  IF v_match_confidence IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'No matching exposure found for this settlement');
  END IF;
  IF v_match_confidence < v_min_confidence THEN
    RETURN jsonb_build_object('allowed', false, 'reason', format('Match confidence (%s%%) below minimum required (%s%%)', v_match_confidence, v_min_confidence));
  END IF;

  RETURN jsonb_build_object('allowed', true, 'confidence', v_match_confidence);
END;
$$;

-- 6) rpc_start_claim_guarded: creates draft claim with logging
CREATE OR REPLACE FUNCTION public.rpc_start_claim_guarded(p_settlement_id uuid, p_match_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_check jsonb;
  v_claim_id uuid;
  v_est_payout numeric;
  v_settlement record;
  v_existing_id uuid;
BEGIN
  -- Run eligibility check
  v_check := rpc_can_start_claim(p_settlement_id);
  
  -- Log attempt
  INSERT INTO claim_attempts (user_id, settlement_id, attempt_type, success, blocked_reason)
  VALUES (v_user_id, p_settlement_id, 'start', (v_check->>'allowed')::boolean, v_check->>'reason');

  IF NOT (v_check->>'allowed')::boolean THEN
    RETURN v_check;
  END IF;

  -- Check for existing draft
  SELECT id INTO v_existing_id FROM claims
  WHERE user_id = v_user_id AND settlement_id = p_settlement_id AND status = 'draft';
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'claim_id', v_existing_id, 'resumed', true);
  END IF;

  -- Create draft
  SELECT payout_min, payout_max INTO v_settlement FROM settlements WHERE id = p_settlement_id;
  v_est_payout := (COALESCE(v_settlement.payout_min, 0) + COALESCE(v_settlement.payout_max, 0)) / 2;

  INSERT INTO claims (user_id, settlement_id, est_payout, status, match_id)
  VALUES (v_user_id, p_settlement_id, v_est_payout, 'draft', p_match_id)
  RETURNING id INTO v_claim_id;

  INSERT INTO claim_applications (claim_id) VALUES (v_claim_id);

  RETURN jsonb_build_object('allowed', true, 'claim_id', v_claim_id, 'resumed', false);
END;
$$;

-- 7) rpc_submit_claim_guarded: validates before submission
CREATE OR REPLACE FUNCTION public.rpc_submit_claim_guarded(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_claim record;
  v_settlement record;
  v_locked_until timestamptz;
  v_fails_24h int;
  v_doc_count int;
  v_req_docs int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not authenticated');
  END IF;

  -- Check lockout
  SELECT locked_until INTO v_locked_until FROM user_risk_flags WHERE user_id = v_user_id;
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Account temporarily locked');
  END IF;

  -- Load claim
  SELECT * INTO v_claim FROM claims WHERE id = p_claim_id AND user_id = v_user_id;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Claim not found');
  END IF;
  IF v_claim.status != 'draft' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Claim already submitted');
  END IF;

  -- Load settlement
  SELECT * INTO v_settlement FROM settlements WHERE id = v_claim.settlement_id;
  IF v_settlement.lifecycle_status != 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement is closed');
  END IF;
  IF v_settlement.claim_deadline IS NOT NULL AND v_settlement.claim_deadline::date < CURRENT_DATE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Settlement deadline has passed');
  END IF;

  -- Rate limit: >3 failed submits in 24h
  SELECT count(*) INTO v_fails_24h FROM claim_attempts
  WHERE user_id = v_user_id AND attempt_type = 'submit' AND success = false AND created_at > now() - interval '24 hours';

  IF v_fails_24h >= 3 THEN
    INSERT INTO user_risk_flags (user_id, locked_until, lock_reason, total_lockouts)
    VALUES (v_user_id, now() + interval '24 hours', 'Excessive failed submissions', 1)
    ON CONFLICT (user_id) DO UPDATE SET
      locked_until = now() + interval '24 hours',
      lock_reason = 'Excessive failed submissions',
      total_lockouts = user_risk_flags.total_lockouts + 1,
      updated_at = now();
    RETURN jsonb_build_object('allowed', false, 'reason', 'Too many failed submissions. Account locked for 24 hours.');
  END IF;

  -- Check required docs
  v_req_docs := COALESCE((v_settlement.eligibility_rules->>'required_docs_count')::int, 0);
  IF v_req_docs > 0 THEN
    SELECT count(*) INTO v_doc_count FROM claim_documents WHERE claim_id = p_claim_id;
    IF v_doc_count < v_req_docs THEN
      INSERT INTO claim_attempts (user_id, settlement_id, attempt_type, success, blocked_reason)
      VALUES (v_user_id, v_claim.settlement_id, 'submit', false, format('Missing documents: %s required, %s uploaded', v_req_docs, v_doc_count));
      RETURN jsonb_build_object('allowed', false, 'reason', format('Please upload at least %s document(s). You have %s.', v_req_docs, v_doc_count));
    END IF;
  END IF;

  -- Success: update claim
  UPDATE claims SET
    status = 'submitted',
    filed_at = CURRENT_DATE,
    eligibility_validated = true,
    updated_at = now()
  WHERE id = p_claim_id;

  INSERT INTO claim_status_history (claim_id, old_status, status, note, updated_by)
  VALUES (p_claim_id, 'draft', 'submitted', 'Claim submitted via guarded flow', 'system');

  INSERT INTO claim_attempts (user_id, settlement_id, attempt_type, success)
  VALUES (v_user_id, v_claim.settlement_id, 'submit', true);

  RETURN jsonb_build_object('allowed', true, 'claim_id', p_claim_id);
END;
$$;
