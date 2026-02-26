
-- 1) Add 'draft' to claim_status_t enum
ALTER TYPE public.claim_status_t ADD VALUE IF NOT EXISTS 'draft' BEFORE 'submitted';

-- 2) Add match_id, decided_at, paid_at to claims
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.settlement_matches(id),
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 3) Unique constraint on (user_id, settlement_id) — prevent duplicate claims
ALTER TABLE public.claims
  ADD CONSTRAINT claims_user_settlement_unique UNIQUE (user_id, settlement_id);

-- 4) Add old_status to claim_status_history
ALTER TABLE public.claim_status_history
  ADD COLUMN IF NOT EXISTS old_status text;

-- 5) Create claim_applications table
CREATE TABLE public.claim_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  address text,
  breach_experience text,
  documentation_available boolean DEFAULT false,
  eligibility_answers jsonb DEFAULT '{}'::jsonb,
  certifications_signed boolean DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS for claim_applications
ALTER TABLE public.claim_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_select_own" ON public.claim_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_applications.claim_id AND c.user_id = auth.uid())
  );

CREATE POLICY "ca_insert_own" ON public.claim_applications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_applications.claim_id AND c.user_id = auth.uid())
  );

CREATE POLICY "ca_update_own" ON public.claim_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_applications.claim_id AND c.user_id = auth.uid())
  );

CREATE POLICY "ca_admin_all" ON public.claim_applications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Index for fast lookups
CREATE INDEX idx_claim_applications_claim_id ON public.claim_applications(claim_id);
