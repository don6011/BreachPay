
-- Add verification fields to settlements table
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_level text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS case_number text,
  ADD COLUMN IF NOT EXISTS administrator_name text,
  ADD COLUMN IF NOT EXISTS official_source_url text,
  ADD COLUMN IF NOT EXISTS claims_filing_url text,
  ADD COLUMN IF NOT EXISTS claim_deadline date,
  ADD COLUMN IF NOT EXISTS notes_internal text;

-- Add a check constraint for verification_level values
ALTER TABLE public.settlements
  ADD CONSTRAINT chk_verification_level
  CHECK (verification_level IN ('unverified', 'source_linked', 'court_verified', 'administrator_confirmed'));
