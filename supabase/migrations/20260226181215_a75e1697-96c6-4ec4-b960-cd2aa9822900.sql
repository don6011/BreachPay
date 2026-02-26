
-- Affiliate links for partner referral tracking
CREATE TABLE public.affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  code text UNIQUE NOT NULL,
  destination_url text DEFAULT '/signup',
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_links_admin_all"
  ON public.affiliate_links FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "affiliate_links_partner_read"
  ON public.affiliate_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM partner_users pu
    WHERE pu.partner_id = affiliate_links.partner_id
    AND pu.user_id = auth.uid()
  ));

CREATE POLICY "affiliate_links_partner_insert"
  ON public.affiliate_links FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM partner_users pu
    WHERE pu.partner_id = affiliate_links.partner_id
    AND pu.user_id = auth.uid()
    AND pu.role IN ('admin', 'agent')
  ));

-- Partner intake logs for tracking inbound referrals
CREATE TABLE public.partner_intake_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) NOT NULL,
  intake_type text NOT NULL CHECK (intake_type IN ('breach', 'claim')),
  email text NOT NULL,
  breach_company text,
  breach_year integer,
  full_name text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_user_id uuid,
  result_claim_id uuid,
  result_scan_run_id uuid,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.partner_intake_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_logs_admin_all"
  ON public.partner_intake_logs FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "intake_logs_partner_read"
  ON public.partner_intake_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM partner_users pu
    WHERE pu.partner_id = partner_intake_logs.partner_id
    AND pu.user_id = auth.uid()
  ));

-- Index for affiliate code lookups
CREATE INDEX idx_affiliate_links_code ON public.affiliate_links(code);
CREATE INDEX idx_partner_intake_logs_partner ON public.partner_intake_logs(partner_id);
CREATE INDEX idx_partner_intake_logs_created ON public.partner_intake_logs(created_at DESC);
