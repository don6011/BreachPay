
-- Add credibility_score and verification_status to settlements
ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS credibility_score integer DEFAULT 85,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'verified';

-- Add media/regulator references as JSONB array
-- Each entry: { "name": "FTC", "url": "https://...", "type": "regulator" | "media" | "court" }
ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS media_references jsonb DEFAULT '[]'::jsonb;

-- Add source transparency links as JSONB array
-- Each entry: { "label": "Court Docket", "url": "https://...", "type": "court_docket" | "administrator" | "regulator" | "settlement_site" }
ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS verification_sources jsonb DEFAULT '[]'::jsonb;
