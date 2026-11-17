-- Settlements: public visitors see only published listings and only public columns.
--
-- Before this migration a policy let anon and authenticated users select every
-- row and every column, so internal notes, credibility scores and unreviewed,
-- rejected, demo and test listings were readable through the public API.
--
-- After it:
--   * Rows: non-admins see only published listings (verified, not demo/test,
--     not rejected or awaiting review). Admins keep full access through the
--     existing settlements_select_admin_full policy.
--   * Columns: anon and authenticated can no longer select notes_internal,
--     verification_notes, credibility_score, created_by or source_id. Admins
--     read those through public.admin_settlement_internal().
--   * Backend functions use the service role and are unaffected.

-- 1. Rows -------------------------------------------------------------------
DROP POLICY IF EXISTS "settlements_select_safe_view" ON public.settlements;
DROP POLICY IF EXISTS "settlements_select_published" ON public.settlements;
CREATE POLICY "settlements_select_published" ON public.settlements
  FOR SELECT TO anon, authenticated
  USING (
    verified = true
    AND coalesce(is_demo, false) = false
    AND coalesce(is_test, false) = false
    AND status NOT IN ('rejected', 'pending_review', 'pending')
  );

-- 2. Columns ----------------------------------------------------------------
REVOKE SELECT ON public.settlements FROM anon, authenticated;
GRANT SELECT (
  id, name, company, status, breach_year, payout_min, payout_max,
  deadline, url, description, tags, created_at, updated_at,
  verified, verification_level, jurisdiction, case_number,
  administrator_name, official_source_url, claims_filing_url,
  claim_deadline, source_type, source_name, source_url,
  last_verified_at, category, final_approval_date,
  eligibility_summary, claim_url, canonical_key,
  verification_status, media_references, verification_sources,
  submission_mode, is_test, is_demo, discovered_at,
  last_checked_at, lifecycle_status, closed_at, eligibility_rules
) ON public.settlements TO anon, authenticated;

-- 3. The old "safe" view ran with its owner's rights, so it ignored row rules
-- and exposed unpublished listings. Nothing in the app reads it.
REVOKE SELECT ON public.v_settlements_safe FROM anon, authenticated;

-- 4. Admin-only access to internal columns -------------------------------------
CREATE OR REPLACE FUNCTION public.admin_settlement_internal(p_ids uuid[])
RETURNS TABLE (id uuid, internal jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id,
         jsonb_build_object(
           'notes_internal', s.notes_internal,
           'verification_notes', s.verification_notes,
           'credibility_score', s.credibility_score,
           'created_by', s.created_by,
           'source_id', s.source_id
         )
  FROM public.settlements s
  WHERE s.id = ANY (p_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_settlement_internal(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_settlement_internal(uuid[]) TO authenticated;

-- 5. The scraper's source list is only used by the admin console.
DROP POLICY IF EXISTS "ss_read_auth" ON public.settlement_sources;
DROP POLICY IF EXISTS "ss_read_admin" ON public.settlement_sources;
CREATE POLICY "ss_read_admin" ON public.settlement_sources
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
