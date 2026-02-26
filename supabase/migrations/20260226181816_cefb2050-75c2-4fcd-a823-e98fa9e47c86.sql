
-- Claim Acceleration Services table
CREATE TABLE public.claim_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id),
  user_id uuid NOT NULL,
  service_type text NOT NULL, -- 'expedited_review', 'doc_verification', 'eligibility_appeal'
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'completed', 'refunded'
  purchased_at timestamptz,
  completed_at timestamptz,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_select_own" ON public.claim_services FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cs_insert_own" ON public.claim_services FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cs_update_own" ON public.claim_services FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "cs_admin_all" ON public.claim_services FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX idx_claim_services_user ON public.claim_services(user_id);
CREATE INDEX idx_claim_services_claim ON public.claim_services(claim_id);

-- Identity Protection partner upsell tracking
CREATE TABLE public.upsell_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  upsell_type text NOT NULL, -- 'credit_monitoring', 'identity_insurance', 'restoration'
  partner_name text,
  placement text, -- 'post_scan', 'post_claim', 'breach_alert', 'dashboard'
  clicked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uc_insert_own" ON public.upsell_clicks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "uc_select_own" ON public.upsell_clicks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "uc_admin_all" ON public.upsell_clicks FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX idx_upsell_clicks_user ON public.upsell_clicks(user_id);
