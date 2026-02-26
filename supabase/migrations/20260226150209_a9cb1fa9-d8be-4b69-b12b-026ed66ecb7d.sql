
-- Referral system
CREATE TABLE public.user_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','activated','qualified','paid')),
  reward_amount numeric DEFAULT 5.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own" ON public.user_referrals
  FOR SELECT USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

CREATE POLICY "referrals_insert_own" ON public.user_referrals
  FOR INSERT WITH CHECK (referrer_user_id = auth.uid());

CREATE POLICY "referrals_admin_all" ON public.user_referrals
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Onboarding tracking: add onboarding_completed flag to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Add referral_code to user_profiles for easy lookup
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Generate unique referral codes for existing users
UPDATE public.user_profiles
SET referral_code = SUBSTRING(md5(user_id::text || now()::text) FROM 1 FOR 8)
WHERE referral_code IS NULL;

-- Trigger to auto-generate referral_code on new profile creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := SUBSTRING(md5(NEW.user_id::text || now()::text) FROM 1 FOR 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();
