
-- Add payout processing columns to claims
ALTER TABLE public.claims
ADD COLUMN IF NOT EXISTS platform_fee numeric,
ADD COLUMN IF NOT EXISTS net_payout numeric;
