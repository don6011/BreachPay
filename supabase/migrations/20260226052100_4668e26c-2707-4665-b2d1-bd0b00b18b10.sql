
-- ============================================================
-- LAUNCH RULE: Remove partner's ability to directly update claims
-- ============================================================
DROP POLICY IF EXISTS "claims_update_partner" ON public.claims;

-- ============================================================
-- LAUNCH RULE: Users can mark doc requests as fulfilled
-- ============================================================
CREATE POLICY "docreq_user_update_fulfilled" ON public.claim_doc_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM claims c
    WHERE c.id = claim_doc_requests.claim_id
      AND c.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM claims c
    WHERE c.id = claim_doc_requests.claim_id
      AND c.user_id = auth.uid()
  )
);

-- ============================================================
-- Step 7: Claim Packet Share Links
-- ============================================================
CREATE TABLE public.claim_packet_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accessed_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz
);

CREATE INDEX idx_packet_shares_token ON public.claim_packet_shares(token);
CREATE INDEX idx_packet_shares_claim ON public.claim_packet_shares(claim_id);

ALTER TABLE public.claim_packet_shares ENABLE ROW LEVEL SECURITY;

-- Users can manage their own share links
CREATE POLICY "packet_shares_select_own" ON public.claim_packet_shares
FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "packet_shares_insert_own" ON public.claim_packet_shares
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM claims c WHERE c.id = claim_packet_shares.claim_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "packet_shares_delete_own" ON public.claim_packet_shares
FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "packet_shares_admin_all" ON public.claim_packet_shares
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- RPC: Create a share link for a claim packet
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_create_packet_share(
  p_claim_id uuid,
  p_hours integer DEFAULT 72
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share record;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM claims WHERE id = p_claim_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Claim not found or access denied';
  END IF;

  -- Expire old shares for this claim
  DELETE FROM claim_packet_shares
  WHERE claim_id = p_claim_id AND user_id = auth.uid() AND expires_at < now();

  -- Create new share
  INSERT INTO claim_packet_shares (claim_id, user_id, expires_at)
  VALUES (p_claim_id, auth.uid(), now() + (p_hours || ' hours')::interval)
  RETURNING * INTO v_share;

  RETURN jsonb_build_object(
    'token', v_share.token,
    'expires_at', v_share.expires_at,
    'id', v_share.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_packet_share(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_create_packet_share(uuid, integer) TO authenticated;
