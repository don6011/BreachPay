
-- ============================================================
-- 1) NEW TABLES
-- ============================================================

-- A) partners (replaces partner_firms concept with partner_type)
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN ('law_firm','claims_admin')),
  website text,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- B) partner_users (who can log in to the portal)
CREATE TABLE IF NOT EXISTS public.partner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, user_id)
);

-- C) claim_assignments (handoff + permissions scope)
CREATE TABLE IF NOT EXISTS public.claim_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  assignment_status text NOT NULL DEFAULT 'assigned'
    CHECK (assignment_status IN ('assigned','in_progress','completed','rejected')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  UNIQUE(claim_id, partner_id)
);

-- D) partner_activity_log (audit trail)
CREATE TABLE IF NOT EXISTS public.partner_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_user_id uuid REFERENCES public.partner_users(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  action text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- E) referrals (monetization rails)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  model text NOT NULL DEFAULT 'cpa' CHECK (model IN ('cpa','rev_share','flat_fee')),
  amount_expected numeric,
  amount_paid numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invoiced','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, claim_id)
);

-- ============================================================
-- 2) RLS
-- ============================================================

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Helper: check if user belongs to a partner org
CREATE OR REPLACE FUNCTION public.get_partner_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.partner_users WHERE user_id = p_user_id LIMIT 1;
$$;

-- partners: admin full access, partner users can read their own org
CREATE POLICY "partners_admin_all" ON public.partners FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "partners_select_own" ON public.partners FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.partner_id = partners.id AND pu.user_id = auth.uid())
);

-- partner_users: self read + admin full
CREATE POLICY "partner_users_admin_all" ON public.partner_users FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "partner_users_self_read" ON public.partner_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "partner_users_org_read" ON public.partner_users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_users pu2 WHERE pu2.partner_id = partner_users.partner_id AND pu2.user_id = auth.uid())
);

-- claim_assignments: partner can read their assignments, admin full
CREATE POLICY "claim_assignments_admin_all" ON public.claim_assignments FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "claim_assignments_partner_read" ON public.claim_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.partner_id = claim_assignments.partner_id AND pu.user_id = auth.uid())
);
CREATE POLICY "claim_assignments_partner_update" ON public.claim_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.partner_id = claim_assignments.partner_id AND pu.user_id = auth.uid() AND pu.role IN ('admin','agent'))
);

-- partner_activity_log: partner can read their log, admin full
CREATE POLICY "pal_admin_all" ON public.partner_activity_log FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "pal_partner_read" ON public.partner_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.partner_id = partner_activity_log.partner_id AND pu.user_id = auth.uid())
);
CREATE POLICY "pal_partner_insert" ON public.partner_activity_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.partner_id = partner_activity_log.partner_id AND pu.user_id = auth.uid())
);

-- referrals: partner can read their referrals, admin full
CREATE POLICY "referrals_admin_all" ON public.referrals FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "referrals_partner_read" ON public.referrals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.partner_id = referrals.partner_id AND pu.user_id = auth.uid())
);

-- ============================================================
-- 3) RPCs (controlled writes)
-- ============================================================

-- A) Partner updates claim status
CREATE OR REPLACE FUNCTION public.rpc_partner_update_claim_status(
  p_claim_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_partner_user_id uuid;
BEGIN
  SELECT pu.partner_id, pu.id INTO v_partner_id, v_partner_user_id
  FROM public.partner_users pu
  JOIN public.claim_assignments ca ON ca.partner_id = pu.partner_id
  WHERE pu.user_id = auth.uid()
    AND ca.claim_id = p_claim_id
    AND pu.role IN ('admin','agent')
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.claims
  SET status = p_new_status::claim_status_t,
      updated_at = now(),
      decided_at = CASE WHEN p_new_status IN ('approved','rejected') THEN now() ELSE decided_at END,
      paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END
  WHERE id = p_claim_id;

  -- Log old_status in claim_status_history
  INSERT INTO public.claim_status_history (claim_id, old_status, status, updated_by, note)
  SELECT id, status::text, p_new_status, 'partner', p_notes
  FROM public.claims WHERE id = p_claim_id;

  -- Audit trail
  INSERT INTO public.partner_activity_log(partner_id, partner_user_id, claim_id, action, meta)
  VALUES (v_partner_id, v_partner_user_id, p_claim_id, 'update_claim_status',
    jsonb_build_object('new_status', p_new_status, 'notes', p_notes));

  -- Enqueue user notification
  INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  SELECT c.user_id, 'in_app', 'claim_status_update',
    jsonb_build_object('claim_id', c.id, 'new_status', p_new_status, 'notes', p_notes),
    'claim_status_update:' || c.user_id || ':' || c.id || ':' || p_new_status
  FROM public.claims c WHERE c.id = p_claim_id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_partner_update_claim_status(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_partner_update_claim_status(uuid, text, text) TO authenticated;

-- B) Partner updates assignment status
CREATE OR REPLACE FUNCTION public.rpc_partner_update_assignment(
  p_claim_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_partner_user_id uuid;
BEGIN
  SELECT pu.partner_id, pu.id INTO v_partner_id, v_partner_user_id
  FROM public.partner_users pu
  JOIN public.claim_assignments ca ON ca.partner_id = pu.partner_id
  WHERE pu.user_id = auth.uid()
    AND ca.claim_id = p_claim_id
    AND pu.role IN ('admin','agent')
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.claim_assignments
  SET assignment_status = p_status,
      notes = COALESCE(p_notes, notes),
      completed_at = CASE WHEN p_status IN ('completed','rejected') THEN now() ELSE completed_at END
  WHERE claim_id = p_claim_id AND partner_id = v_partner_id;

  INSERT INTO public.partner_activity_log(partner_id, partner_user_id, claim_id, action, meta)
  VALUES (v_partner_id, v_partner_user_id, p_claim_id, 'update_assignment',
    jsonb_build_object('status', p_status, 'notes', p_notes));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_partner_update_assignment(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_partner_update_assignment(uuid, text, text) TO authenticated;

-- C) Partner adds a note to a claim
CREATE OR REPLACE FUNCTION public.rpc_partner_add_note(
  p_claim_id uuid,
  p_note text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_partner_user_id uuid;
  v_note_id uuid;
BEGIN
  SELECT pu.partner_id, pu.id INTO v_partner_id, v_partner_user_id
  FROM public.partner_users pu
  JOIN public.claim_assignments ca ON ca.partner_id = pu.partner_id
  WHERE pu.user_id = auth.uid()
    AND ca.claim_id = p_claim_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.claim_partner_notes(claim_id, partner_id, note)
  VALUES (p_claim_id, auth.uid(), p_note)
  RETURNING id INTO v_note_id;

  INSERT INTO public.partner_activity_log(partner_id, partner_user_id, claim_id, action, meta)
  VALUES (v_partner_id, v_partner_user_id, p_claim_id, 'add_note',
    jsonb_build_object('note_id', v_note_id));

  RETURN v_note_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_partner_add_note(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_partner_add_note(uuid, text) TO authenticated;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON public.partner_users(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_partner_id ON public.partner_users(partner_id);
CREATE INDEX IF NOT EXISTS idx_claim_assignments_claim_id ON public.claim_assignments(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_assignments_partner_id ON public.claim_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_activity_log_partner_id ON public.partner_activity_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_activity_log_claim_id ON public.partner_activity_log(claim_id);
CREATE INDEX IF NOT EXISTS idx_referrals_partner_id ON public.referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_claim_id ON public.referrals(claim_id);
