
-- 1. User fingerprints for duplicate detection
CREATE TABLE public.user_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_hash text,
  phone_hash text,
  ip_hash text,
  device_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uf_select_own" ON public.user_fingerprints
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "uf_insert_own" ON public.user_fingerprints
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "uf_admin_all" ON public.user_fingerprints
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX idx_uf_email_hash ON public.user_fingerprints(email_hash);
CREATE INDEX idx_uf_phone_hash ON public.user_fingerprints(phone_hash);
CREATE INDEX idx_uf_ip_hash ON public.user_fingerprints(ip_hash);
CREATE INDEX idx_uf_device_hash ON public.user_fingerprints(device_hash);

-- 2. Add exposure_confidence to claims (fraud_flag already exists as 'flagged')
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS exposure_confidence int NOT NULL DEFAULT 75;

-- 3. Add file_hash to claim_documents for duplicate detection
ALTER TABLE public.claim_documents
  ADD COLUMN IF NOT EXISTS file_hash text;

CREATE INDEX idx_cd_file_hash ON public.claim_documents(file_hash);

-- 4. Add fraud_flag to referrals
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS fraud_flag boolean NOT NULL DEFAULT false;

-- 5. Add fraud_flag to partner_intake_logs
ALTER TABLE public.partner_intake_logs
  ADD COLUMN IF NOT EXISTS fraud_flag boolean NOT NULL DEFAULT false;

-- 6. Fraud scoring function - computes composite score per claim
CREATE OR REPLACE FUNCTION public.compute_fraud_score(p_claim_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score int := 0;
  v_user_id uuid;
  v_settlement_id uuid;
  v_phone_hash text;
  v_ip_hash text;
  v_device_hash text;
  v_dup_phone int;
  v_dup_ip int;
  v_dup_device int;
  v_dup_docs int;
BEGIN
  SELECT user_id, settlement_id INTO v_user_id, v_settlement_id
  FROM claims WHERE id = p_claim_id;

  IF v_user_id IS NULL THEN RETURN 0; END IF;

  -- Get fingerprint
  SELECT phone_hash, ip_hash, device_hash
  INTO v_phone_hash, v_ip_hash, v_device_hash
  FROM user_fingerprints
  WHERE user_id = v_user_id
  ORDER BY created_at DESC LIMIT 1;

  -- Duplicate phone across different users
  IF v_phone_hash IS NOT NULL THEN
    SELECT count(DISTINCT user_id) INTO v_dup_phone
    FROM user_fingerprints
    WHERE phone_hash = v_phone_hash AND user_id != v_user_id;
    IF v_dup_phone > 0 THEN v_score := v_score + 25; END IF;
  END IF;

  -- Suspicious IP cluster (3+ claims from same IP in 24h)
  IF v_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_dup_ip
    FROM user_fingerprints uf
    JOIN claims c ON c.user_id = uf.user_id
    WHERE uf.ip_hash = v_ip_hash
      AND uf.user_id != v_user_id
      AND c.created_at > now() - interval '24 hours';
    IF v_dup_ip >= 3 THEN v_score := v_score + 20; END IF;
  END IF;

  -- Duplicate device
  IF v_device_hash IS NOT NULL THEN
    SELECT count(DISTINCT user_id) INTO v_dup_device
    FROM user_fingerprints
    WHERE device_hash = v_device_hash AND user_id != v_user_id;
    IF v_dup_device > 0 THEN v_score := v_score + 15; END IF;
  END IF;

  -- Document reuse (same file_hash on different claims)
  SELECT count(*) INTO v_dup_docs
  FROM claim_documents cd1
  JOIN claim_documents cd2 ON cd1.file_hash = cd2.file_hash
    AND cd1.file_hash IS NOT NULL
    AND cd1.claim_id != cd2.claim_id
  WHERE cd1.claim_id = p_claim_id;
  IF v_dup_docs > 0 THEN v_score := v_score + 30; END IF;

  RETURN LEAST(v_score, 100);
END;
$$;

-- 7. Trigger: auto-flag claims with high fraud score on status change to submitted
CREATE OR REPLACE FUNCTION public.trg_fraud_check_on_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score int;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    v_score := compute_fraud_score(NEW.id);
    IF v_score >= 70 THEN
      NEW.flagged := true;
      NEW.flag_reason := 'Auto-flagged: fraud score ' || v_score || '/100';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim_fraud_check ON public.claims;
CREATE TRIGGER trg_claim_fraud_check
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fraud_check_on_submit();
