
-- Add verified flag and verification_code to monitored_identifiers
ALTER TABLE public.monitored_identifiers
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_label text;

-- Add index for quick lookup during verification
CREATE INDEX IF NOT EXISTS idx_monitored_identifiers_verification
  ON public.monitored_identifiers (user_id, type, verification_code)
  WHERE verification_code IS NOT NULL;
