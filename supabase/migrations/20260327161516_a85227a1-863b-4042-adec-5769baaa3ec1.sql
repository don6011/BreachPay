
-- Fix claim_status_history partner policies using partner_id = auth.uid() incorrectly
DROP POLICY IF EXISTS "claim_status_history_insert_partner" ON public.claim_status_history;
CREATE POLICY "claim_status_history_insert_partner" ON public.claim_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_status_history.claim_id
        AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "claim_status_history_select_partner" ON public.claim_status_history;
CREATE POLICY "claim_status_history_select_partner" ON public.claim_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_status_history.claim_id
        AND pu.user_id = auth.uid()
    )
  );

-- Fix claim_tasks partner policies
DROP POLICY IF EXISTS "ct_insert_partner" ON public.claim_tasks;
CREATE POLICY "ct_insert_partner" ON public.claim_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_tasks.claim_id
        AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ct_select_partner" ON public.claim_tasks;
CREATE POLICY "ct_select_partner" ON public.claim_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_tasks.claim_id
        AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ct_update_partner" ON public.claim_tasks;
CREATE POLICY "ct_update_partner" ON public.claim_tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_tasks.claim_id
        AND pu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_tasks.claim_id
        AND pu.user_id = auth.uid()
    )
  );

-- Fix claim_documents partner select policy
DROP POLICY IF EXISTS "cd_select_partner" ON public.claim_documents;
CREATE POLICY "cd_select_partner" ON public.claim_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.partner_users pu ON pu.partner_id = c.partner_id
      WHERE c.id = claim_documents.claim_id
        AND pu.user_id = auth.uid()
    )
  );
