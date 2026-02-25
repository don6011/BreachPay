
-- Add settlement and verification columns to breach_catalog
ALTER TABLE public.breach_catalog
  ADD COLUMN IF NOT EXISTS records_exposed bigint,
  ADD COLUMN IF NOT EXISTS data_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS settlement_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS settlement_name text,
  ADD COLUMN IF NOT EXISTS estimated_payout_min numeric,
  ADD COLUMN IF NOT EXISTS estimated_payout_max numeric,
  ADD COLUMN IF NOT EXISTS claim_deadline date,
  ADD COLUMN IF NOT EXISTS law_firm_partner text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending';

-- Backfill verification_status from existing verified column
UPDATE public.breach_catalog
SET verification_status = CASE WHEN verified THEN 'verified' ELSE 'pending' END
WHERE verification_status = 'pending';

-- Backfill data_types from exposed_fields text
UPDATE public.breach_catalog
SET data_types = string_to_array(replace(exposed_fields, ' ', ''), ',')
WHERE data_types = '{}' AND exposed_fields IS NOT NULL AND exposed_fields != '';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_breach_catalog_company ON public.breach_catalog (company);
CREATE INDEX IF NOT EXISTS idx_breach_catalog_breach_year ON public.breach_catalog (breach_year);
CREATE INDEX IF NOT EXISTS idx_breach_catalog_claim_deadline ON public.breach_catalog (claim_deadline);
CREATE INDEX IF NOT EXISTS idx_breach_catalog_settlement_available ON public.breach_catalog (settlement_available);
CREATE INDEX IF NOT EXISTS idx_breach_catalog_verification_status ON public.breach_catalog (verification_status);
