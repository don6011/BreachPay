
-- Alter existing claim_partner_notes: add partner_user_id and visibility
ALTER TABLE public.claim_partner_notes
  ADD COLUMN IF NOT EXISTS partner_user_id uuid REFERENCES public.partner_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal';

-- Add check constraint for visibility
ALTER TABLE public.claim_partner_notes
  ADD CONSTRAINT claim_partner_notes_visibility_check CHECK (visibility IN ('internal','user_visible'));

CREATE INDEX IF NOT EXISTS idx_partner_notes_claim ON public.claim_partner_notes(claim_id, created_at DESC);

-- Create claim_doc_requests table
CREATE TABLE IF NOT EXISTS public.claim_doc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_user_id uuid REFERENCES public.partner_users(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('breach_notice','receipt','identity_verification','proof_of_address','other')),
  message text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_doc_requests_claim ON public.claim_doc_requests(claim_id, status, created_at DESC);

ALTER TABLE public.claim_doc_requests ENABLE ROW LEVEL SECURITY;

-- Drop old RLS policies on claim_partner_notes and replace
DROP POLICY IF EXISTS "partner_notes_insert_partner" ON public.claim_partner_notes;
DROP POLICY IF EXISTS "partner_notes_select_partner_or_admin" ON public.claim_partner_notes;
DROP POLICY IF EXISTS "partner_notes_delete_admin" ON public.claim_partner_notes;

CREATE POLICY "partner_notes_read" ON public.claim_partner_notes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.claim_assignments ca
    JOIN public.partner_users pu ON pu.partner_id = ca.partner_id
    WHERE ca.claim_id = claim_partner_notes.claim_id AND pu.user_id = auth.uid()
  ) OR is_admin()
);

CREATE POLICY "partner_notes_insert" ON public.claim_partner_notes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.claim_assignments ca
    JOIN public.partner_users pu ON pu.partner_id = ca.partner_id
    WHERE ca.claim_id = claim_partner_notes.claim_id AND pu.user_id = auth.uid()
  ) OR is_admin()
);

CREATE POLICY "partner_notes_delete" ON public.claim_partner_notes
FOR DELETE USING (is_admin());

-- User can see user_visible notes on their own claims
CREATE POLICY "partner_notes_user_visible" ON public.claim_partner_notes
FOR SELECT USING (
  visibility = 'user_visible' AND EXISTS (
    SELECT 1 FROM public.claims c WHERE c.id = claim_partner_notes.claim_id AND c.user_id = auth.uid()
  )
);

-- Doc requests policies
CREATE POLICY "partner_docreq_read" ON public.claim_doc_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.claim_assignments ca
    JOIN public.partner_users pu ON pu.partner_id = ca.partner_id
    WHERE ca.claim_id = claim_doc_requests.claim_id AND pu.user_id = auth.uid()
  ) OR is_admin()
);

CREATE POLICY "partner_docreq_insert" ON public.claim_doc_requests
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.claim_assignments ca
    JOIN public.partner_users pu ON pu.partner_id = ca.partner_id
    WHERE ca.claim_id = claim_doc_requests.claim_id AND pu.user_id = auth.uid()
  ) OR is_admin()
);

CREATE POLICY "partner_docreq_update" ON public.claim_doc_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.claim_assignments ca
    JOIN public.partner_users pu ON pu.partner_id = ca.partner_id
    WHERE ca.claim_id = claim_doc_requests.claim_id AND pu.user_id = auth.uid()
  ) OR is_admin()
);

-- User can see doc requests on their own claims
CREATE POLICY "docreq_user_read" ON public.claim_doc_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.claims c WHERE c.id = claim_doc_requests.claim_id AND c.user_id = auth.uid()
  )
);

-- RPC: partner add claim note (replaces old rpc_partner_add_note)
CREATE OR REPLACE FUNCTION public.rpc_partner_add_claim_note(
  p_claim_id uuid,
  p_note text,
  p_visibility text DEFAULT 'internal'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_partner_user_id uuid;
BEGIN
  SELECT pu.partner_id, pu.id
  INTO v_partner_id, v_partner_user_id
  FROM public.partner_users pu
  JOIN public.claim_assignments ca ON ca.partner_id = pu.partner_id
  WHERE pu.user_id = auth.uid() AND ca.claim_id = p_claim_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.claim_partner_notes(claim_id, partner_id, partner_user_id, note, visibility)
  VALUES (p_claim_id, v_partner_id, v_partner_user_id, p_note, p_visibility);

  IF p_visibility = 'user_visible' THEN
    INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
    SELECT c.user_id, 'in_app', 'partner_note',
      jsonb_build_object('claim_id', c.id, 'note', p_note),
      'partner_note:' || c.user_id || ':' || c.id || ':' || md5(p_note)
    FROM public.claims c WHERE c.id = p_claim_id
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_partner_add_claim_note(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_partner_add_claim_note(uuid, text, text) TO authenticated;

-- RPC: partner request document
CREATE OR REPLACE FUNCTION public.rpc_partner_request_document(
  p_claim_id uuid,
  p_request_type text,
  p_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_partner_user_id uuid;
BEGIN
  SELECT pu.partner_id, pu.id
  INTO v_partner_id, v_partner_user_id
  FROM public.partner_users pu
  JOIN public.claim_assignments ca ON ca.partner_id = pu.partner_id
  WHERE pu.user_id = auth.uid() AND ca.claim_id = p_claim_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.claim_doc_requests(claim_id, partner_id, partner_user_id, request_type, message)
  VALUES (p_claim_id, v_partner_id, v_partner_user_id, p_request_type, p_message);

  INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  SELECT c.user_id, 'in_app', 'doc_request',
    jsonb_build_object('claim_id', c.id, 'request_type', p_request_type, 'message', p_message),
    'doc_request:' || c.user_id || ':' || c.id || ':' || p_request_type || ':' || date_trunc('day', now())::text
  FROM public.claims c WHERE c.id = p_claim_id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_partner_request_document(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_partner_request_document(uuid, text, text) TO authenticated;
