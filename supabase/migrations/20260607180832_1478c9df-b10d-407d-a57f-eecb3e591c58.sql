
-- 1. Partner storage SELECT policy
DROP POLICY IF EXISTS "Users read own claim docs" ON storage.objects;
CREATE POLICY "Users read own claim docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'claim-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin()
      OR EXISTS (
        SELECT 1 FROM public.claim_documents cd
        JOIN public.claims c ON c.id = cd.claim_id
        JOIN public.partner_users pu ON pu.partner_id = c.partner_id
        WHERE cd.file_path = objects.name AND pu.user_id = auth.uid()
      )
    )
  );

-- 2. Claim-packets ownership check
DROP POLICY IF EXISTS "claim_packets_bucket_owner_insert" ON storage.objects;
CREATE POLICY "claim_packets_bucket_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'claim-packets'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[2]
    )
  );

-- 3. Settlements internal-column protection
CREATE OR REPLACE VIEW public.v_settlements_safe AS
SELECT
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
FROM public.settlements;

GRANT SELECT ON public.v_settlements_safe TO authenticated, anon;

DROP POLICY IF EXISTS "settlements_select_authenticated" ON public.settlements;
DROP POLICY IF EXISTS "settlements_select_admin_full" ON public.settlements;
DROP POLICY IF EXISTS "settlements_select_safe_view" ON public.settlements;
CREATE POLICY "settlements_select_admin_full" ON public.settlements
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "settlements_select_safe_view" ON public.settlements
  FOR SELECT TO authenticated, anon
  USING (true);

-- 4. search_path on procedures + function
ALTER PROCEDURE public.proc_run_scheduled_scans_catalog_demo(integer) SET search_path = 'public';
ALTER PROCEDURE public.proc_run_scheduled_scans_demo(integer) SET search_path = 'public';
ALTER PROCEDURE public.proc_rebuild_settlement_matches() SET search_path = 'public';
ALTER PROCEDURE public.proc_run_deadline_alerts() SET search_path = 'public';
ALTER FUNCTION public.call_edge_function(text, text) SET search_path = 'public';

-- 5. Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.auto_archive_expired_settlements() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_route_claim_to_queue() FROM anon;
REVOKE EXECUTE ON FUNCTION public.call_edge_function(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_fraud_score(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_due_scan_jobs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_partner_id_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_partner_ids_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.normalize_raw_ingest(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_claim_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.proc_archive_expired_settlements() FROM anon;
REVOKE EXECUTE ON FUNCTION public.proc_claim_outbox(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.proc_cron_scan_jobs(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.proc_enqueue_due_jobs(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.proc_run_scheduled_jobs(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_admin_verify_settlement(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_can_start_claim(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_partner_update_assignment(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_partner_update_claim_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_start_claim_guarded(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_submit_claim_guarded(uuid) FROM anon;
