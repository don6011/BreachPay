-- Add submission_mode and is_test to settlements
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS submission_mode text NOT NULL DEFAULT 'packet_only',
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Validation trigger for submission_mode
CREATE OR REPLACE FUNCTION public.validate_settlement_submission_mode()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.submission_mode NOT IN ('packet_only', 'redirect_official', 'partner_api') THEN
    RAISE EXCEPTION 'Invalid submission_mode: %', NEW.submission_mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_settlement_submission_mode ON public.settlements;
CREATE TRIGGER trg_validate_settlement_submission_mode
  BEFORE INSERT OR UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.validate_settlement_submission_mode();

-- Add submission fields to claims
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS submission_channel text NOT NULL DEFAULT 'packet_only',
  ADD COLUMN IF NOT EXISTS submitted_to_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_submission_ref text,
  ADD COLUMN IF NOT EXISTS packet_generated_at timestamptz;

-- Validation trigger for submission_channel
CREATE OR REPLACE FUNCTION public.validate_claim_submission_channel()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.submission_channel NOT IN ('packet_only', 'redirect_official', 'partner_api') THEN
    RAISE EXCEPTION 'Invalid submission_channel: %', NEW.submission_channel;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_claim_submission_channel ON public.claims;
CREATE TRIGGER trg_validate_claim_submission_channel
  BEFORE INSERT OR UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_claim_submission_channel();

-- Add packet_url to claim_packets
ALTER TABLE public.claim_packets
  ADD COLUMN IF NOT EXISTS packet_url text;