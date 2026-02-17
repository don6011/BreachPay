
-- partner_firms
CREATE TABLE public.partner_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  contact_email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pf_select_admin" ON public.partner_firms FOR SELECT USING (public.is_admin());
CREATE POLICY "pf_insert_admin" ON public.partner_firms FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "pf_update_admin" ON public.partner_firms FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "pf_delete_admin" ON public.partner_firms FOR DELETE USING (public.is_admin());

-- partner_profiles
CREATE TABLE public.partner_profiles (
  user_id uuid PRIMARY KEY,
  firm_id uuid REFERENCES public.partner_firms(id),
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_select_own" ON public.partner_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pp_update_own" ON public.partner_profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pp_insert_own" ON public.partner_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pp_select_admin" ON public.partner_profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "pp_manage_admin" ON public.partner_profiles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Partner can read own firm
CREATE POLICY "pf_select_partner" ON public.partner_firms FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.partner_profiles pp WHERE pp.firm_id = partner_firms.id AND pp.user_id = auth.uid()));

-- partner_firm_id on claims
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS partner_firm_id uuid REFERENCES public.partner_firms(id);

-- claim_tasks
CREATE TABLE public.claim_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id),
  assigned_to_role text NOT NULL DEFAULT 'partner',
  task_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.claim_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_admin_all" ON public.claim_tasks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "ct_select_partner" ON public.claim_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id AND c.partner_id = auth.uid()));
CREATE POLICY "ct_insert_partner" ON public.claim_tasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id AND c.partner_id = auth.uid()));
CREATE POLICY "ct_update_partner" ON public.claim_tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id AND c.partner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id AND c.partner_id = auth.uid()));
CREATE POLICY "ct_select_user" ON public.claim_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id AND c.user_id = auth.uid()));
