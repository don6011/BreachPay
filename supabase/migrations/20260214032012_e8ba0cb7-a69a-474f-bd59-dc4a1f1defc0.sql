
-- 1. Add partner_id column to claims table
ALTER TABLE public.claims ADD COLUMN partner_id uuid;

-- 2. Create claim_partner_notes table
CREATE TABLE public.claim_partner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_partner_notes ENABLE ROW LEVEL SECURITY;

-- Partners can read/write notes on their assigned claims
CREATE POLICY "partner_notes_select_partner_or_admin"
  ON public.claim_partner_notes FOR SELECT
  USING (
    partner_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "partner_notes_insert_partner"
  ON public.claim_partner_notes FOR INSERT
  WITH CHECK (
    partner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.claims c WHERE c.id = claim_partner_notes.claim_id AND c.partner_id = auth.uid()
    )
  );

CREATE POLICY "partner_notes_delete_admin"
  ON public.claim_partner_notes FOR DELETE
  USING (is_admin());

-- 3. Update claims RLS: partners can SELECT claims assigned to them
CREATE POLICY "claims_select_partner"
  ON public.claims FOR SELECT
  USING (partner_id = auth.uid());

-- 4. Partners can UPDATE claims assigned to them (for status changes via partner review)
CREATE POLICY "claims_update_partner"
  ON public.claims FOR UPDATE
  USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- 5. Partners can SELECT claim_status_history for their assigned claims
CREATE POLICY "claim_status_history_select_partner"
  ON public.claim_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c WHERE c.id = claim_status_history.claim_id AND c.partner_id = auth.uid()
    )
  );

-- 6. Partners can INSERT claim_status_history for their assigned claims
CREATE POLICY "claim_status_history_insert_partner"
  ON public.claim_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c WHERE c.id = claim_status_history.claim_id AND c.partner_id = auth.uid()
    )
  );

-- 7. Partners can SELECT claim_documents for their assigned claims
CREATE POLICY "claim_documents_select_partner"
  ON public.claim_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c WHERE c.id = claim_documents.claim_id AND c.partner_id = auth.uid()
    )
  );

-- 8. Partners can read settlements (already allowed for authenticated users, but ensure)
-- Already covered by settlements_select_authenticated policy

-- 9. Partners can SELECT alerts they create (for documentation requests)
CREATE POLICY "alerts_insert_partner"
  ON public.alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'partner'
    )
  );
