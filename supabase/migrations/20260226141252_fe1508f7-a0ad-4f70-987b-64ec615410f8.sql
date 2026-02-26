
-- 1) Alter existing payouts table: add method, external_ref, unique on claim_id
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS method text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS external_ref text;

-- Add check constraint for method
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_method_check CHECK (method IN ('unknown','check','ach','paypal','gift_card'));

-- Add check constraint for status (drop old if text default only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payouts_status_check' AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE public.payouts ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending','processing','paid','failed','void'));
  END IF;
END $$;

-- Unique on claim_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payouts_claim_id_key' AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE public.payouts ADD CONSTRAINT payouts_claim_id_key UNIQUE (claim_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.payouts(user_id, created_at DESC);

-- 2) claim_payout_events
CREATE TABLE IF NOT EXISTS public.claim_payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('marked_paid','amount_updated','method_updated','status_changed')),
  meta jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claim_payout_events_claim ON public.claim_payout_events(claim_id, created_at DESC);

ALTER TABLE public.claim_payout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpe_admin_all" ON public.claim_payout_events FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "cpe_owner_select" ON public.claim_payout_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM claims c WHERE c.id = claim_payout_events.claim_id AND c.user_id = auth.uid()
  ));

-- 3) partner_invoices
CREATE TABLE IF NOT EXISTS public.partner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void')),
  subtotal numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_partner ON public.partner_invoices(partner_id, created_at DESC);

ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pi_admin_all" ON public.partner_invoices FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "pi_partner_select" ON public.partner_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM partner_users pu WHERE pu.partner_id = partner_invoices.partner_id AND pu.user_id = auth.uid()
  ));

-- 4) partner_invoice_items
CREATE TABLE IF NOT EXISTS public.partner_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.partner_invoices(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  description text,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, referral_id)
);

ALTER TABLE public.partner_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pii_admin_all" ON public.partner_invoice_items FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "pii_partner_select" ON public.partner_invoice_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM partner_invoices pi
    JOIN partner_users pu ON pu.partner_id = pi.partner_id
    WHERE pi.id = partner_invoice_items.invoice_id AND pu.user_id = auth.uid()
  ));

-- 5) Unique partial index on notification_outbox.dedupe_key for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_dedupe
  ON public.notification_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 6) Admin RPC: mark claim paid (uses final_payout instead of payout_actual)
CREATE OR REPLACE FUNCTION public.rpc_admin_mark_claim_paid(
  p_claim_id uuid,
  p_amount numeric,
  p_method text DEFAULT 'unknown',
  p_external_ref text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Admin check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT user_id INTO v_user_id FROM public.claims WHERE id = p_claim_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'claim_not_found';
  END IF;

  -- Update claim
  UPDATE public.claims
  SET status = 'paid', paid_at = now(), final_payout = p_amount, updated_at = now()
  WHERE id = p_claim_id;

  -- Upsert payout
  INSERT INTO public.payouts(user_id, claim_id, amount, method, status, paid_at, external_ref)
  VALUES (v_user_id, p_claim_id, p_amount, p_method, 'paid', now(), p_external_ref)
  ON CONFLICT (claim_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    method = EXCLUDED.method,
    status = 'paid',
    paid_at = EXCLUDED.paid_at,
    external_ref = EXCLUDED.external_ref,
    updated_at = now();

  -- Audit event
  INSERT INTO public.claim_payout_events(claim_id, event_type, meta, created_by)
  VALUES (p_claim_id, 'marked_paid',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'external_ref', p_external_ref),
    auth.uid()
  );

  -- Update referral status
  UPDATE public.referrals
  SET status = 'invoiced'
  WHERE claim_id = p_claim_id AND status = 'pending';

  -- Notify user (in_app + email)
  INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  VALUES (
    v_user_id, 'in_app', 'payout_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method),
    'payout_paid:' || v_user_id || ':' || p_claim_id
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  VALUES (
    v_user_id, 'email', 'payout_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method),
    'payout_paid_email:' || v_user_id || ':' || p_claim_id
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;
