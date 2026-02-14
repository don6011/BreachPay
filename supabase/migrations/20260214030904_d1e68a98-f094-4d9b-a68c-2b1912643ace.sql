
-- 1) Create a no-arg is_admin() helper (SECURITY DEFINER, safe search_path)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  );
$$;

-- 2) Add 'partner' to user_roles check constraint if not already present
-- Drop old constraint and add new one
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('user', 'admin', 'partner'));

-- ============================================================
-- CLAIMS
-- ============================================================
DROP POLICY IF EXISTS "Admins manage all claims" ON public.claims;
DROP POLICY IF EXISTS "Users insert own claims" ON public.claims;
DROP POLICY IF EXISTS "Users view own claims" ON public.claims;

CREATE POLICY "claims_select_own_or_admin" ON public.claims FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "claims_insert_own" ON public.claims FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "claims_update_own_or_admin" ON public.claims FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "claims_delete_admin" ON public.claims FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- CLAIM_DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "Admins manage all claim documents" ON public.claim_documents;
DROP POLICY IF EXISTS "Users manage own documents" ON public.claim_documents;

CREATE POLICY "claim_documents_select_own_or_admin" ON public.claim_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_documents.claim_id
      AND (c.user_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY "claim_documents_insert_own_or_admin" ON public.claim_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_documents.claim_id
      AND (c.user_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY "claim_documents_update_admin_or_owner" ON public.claim_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_documents.claim_id
      AND (c.user_id = auth.uid() OR public.is_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_documents.claim_id
      AND (c.user_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY "claim_documents_delete_admin" ON public.claim_documents FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- CLAIM_STATUS_HISTORY
-- ============================================================
DROP POLICY IF EXISTS "Admins manage claim history" ON public.claim_status_history;
DROP POLICY IF EXISTS "Users insert own claim history" ON public.claim_status_history;
DROP POLICY IF EXISTS "Users view own claim history" ON public.claim_status_history;

CREATE POLICY "claim_status_history_select_own_or_admin" ON public.claim_status_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_status_history.claim_id
      AND (c.user_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY "claim_status_history_insert_admin" ON public.claim_status_history FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "claim_status_history_update_admin" ON public.claim_status_history FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "claim_status_history_delete_admin" ON public.claim_status_history FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- SETTLEMENTS
-- ============================================================
DROP POLICY IF EXISTS "Admins manage settlements" ON public.settlements;
DROP POLICY IF EXISTS "Anyone can view settlements" ON public.settlements;

CREATE POLICY "settlements_select_authenticated" ON public.settlements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "settlements_insert_admin" ON public.settlements FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "settlements_update_admin" ON public.settlements FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "settlements_delete_admin" ON public.settlements FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- BREACH_EVENTS
-- ============================================================
DROP POLICY IF EXISTS "Admins view all breaches" ON public.breach_events;
DROP POLICY IF EXISTS "Users view own breaches" ON public.breach_events;

CREATE POLICY "breach_events_select_own_or_admin" ON public.breach_events FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "breach_events_insert_admin" ON public.breach_events FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "breach_events_update_admin" ON public.breach_events FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "breach_events_delete_admin" ON public.breach_events FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- SETTLEMENT_MATCHES
-- ============================================================
DROP POLICY IF EXISTS "Admins view all matches" ON public.settlement_matches;
DROP POLICY IF EXISTS "Users view own matches" ON public.settlement_matches;

CREATE POLICY "settlement_matches_select_own_or_admin" ON public.settlement_matches FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "settlement_matches_insert_admin" ON public.settlement_matches FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "settlement_matches_update_admin" ON public.settlement_matches FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "settlement_matches_delete_admin" ON public.settlement_matches FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- ALERTS
-- ============================================================
DROP POLICY IF EXISTS "Users update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users view own alerts" ON public.alerts;

CREATE POLICY "alerts_select_own_or_admin" ON public.alerts FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "alerts_insert_admin" ON public.alerts FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "alerts_update_own_or_admin" ON public.alerts FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "alerts_delete_admin" ON public.alerts FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
DROP POLICY IF EXISTS "Users update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users view own subscription" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own_or_admin" ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscriptions_upsert_own" ON public.subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_update_own_or_admin" ON public.subscriptions FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscriptions_delete_admin" ON public.subscriptions FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- ADMIN_ACTIVITY_LOGS
-- ============================================================
DROP POLICY IF EXISTS "Admins insert activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Admins view activity logs" ON public.admin_activity_logs;

CREATE POLICY "admin_activity_logs_admin_only" ON public.admin_activity_logs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- SCAN_RUNS
-- ============================================================
DROP POLICY IF EXISTS "Admins view all scans" ON public.scan_runs;
DROP POLICY IF EXISTS "Users insert own scans" ON public.scan_runs;
DROP POLICY IF EXISTS "Users view own scans" ON public.scan_runs;

CREATE POLICY "scan_runs_select_own_or_admin" ON public.scan_runs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "scan_runs_insert_admin" ON public.scan_runs FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================
-- USER_ROLES (keep existing, standardize)
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_manage_admin" ON public.user_roles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- AUTOMATION_RUNS (standardize)
-- ============================================================
DROP POLICY IF EXISTS "automation_runs_admin_or_service" ON public.automation_runs;

CREATE POLICY "automation_runs_admin_only" ON public.automation_runs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
