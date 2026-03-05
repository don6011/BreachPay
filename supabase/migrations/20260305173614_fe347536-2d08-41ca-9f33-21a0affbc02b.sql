
-- Fix: drop conflicting policy then recreate all remaining tables
DROP POLICY IF EXISTS "Users insert own ticket messages" ON public.support_ticket_messages;

-- Re-run everything with DROP IF EXISTS for safety
-- Tables that may already have some policies

-- 1. user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own profile" ON public.user_profiles;
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 2. claim_applications
ALTER TABLE public.claim_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own claim apps" ON public.claim_applications;
CREATE POLICY "Users read own claim apps" ON public.claim_applications FOR SELECT TO authenticated
  USING (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own claim apps" ON public.claim_applications;
CREATE POLICY "Users insert own claim apps" ON public.claim_applications FOR INSERT TO authenticated
  WITH CHECK (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users update own claim apps" ON public.claim_applications;
CREATE POLICY "Users update own claim apps" ON public.claim_applications FOR UPDATE TO authenticated
  USING (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));

-- 3. user_fingerprints
ALTER TABLE public.user_fingerprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own fingerprints" ON public.user_fingerprints;
CREATE POLICY "Users insert own fingerprints" ON public.user_fingerprints FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users read own fingerprints" ON public.user_fingerprints;
CREATE POLICY "Users read own fingerprints" ON public.user_fingerprints FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own tickets" ON public.support_tickets;
CREATE POLICY "Users read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own tickets" ON public.support_tickets;
CREATE POLICY "Users insert own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own tickets" ON public.support_tickets;
CREATE POLICY "Users update own tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 5. support_ticket_messages
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users read own ticket messages" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users insert own ticket messages" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid()));

-- 6. claim_documents
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own docs" ON public.claim_documents;
CREATE POLICY "Users read own docs" ON public.claim_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own docs" ON public.claim_documents;
CREATE POLICY "Users insert own docs" ON public.claim_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own docs" ON public.claim_documents;
CREATE POLICY "Users update own docs" ON public.claim_documents FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own uploaded docs" ON public.claim_documents;
CREATE POLICY "Users delete own uploaded docs" ON public.claim_documents FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'uploaded');

-- 7. breach_events
ALTER TABLE public.breach_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own breaches" ON public.breach_events;
CREATE POLICY "Users read own breaches" ON public.breach_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 8. monitored_identifiers
ALTER TABLE public.monitored_identifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own identifiers" ON public.monitored_identifiers;
CREATE POLICY "Users read own identifiers" ON public.monitored_identifiers FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own identifiers" ON public.monitored_identifiers;
CREATE POLICY "Users insert own identifiers" ON public.monitored_identifiers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own identifiers" ON public.monitored_identifiers;
CREATE POLICY "Users update own identifiers" ON public.monitored_identifiers FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 9. claims
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own claims" ON public.claims;
CREATE POLICY "Users read own claims" ON public.claims FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own claims" ON public.claims;
CREATE POLICY "Users insert own claims" ON public.claims FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own claims" ON public.claims;
CREATE POLICY "Users update own claims" ON public.claims FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 10. payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payouts" ON public.payouts;
CREATE POLICY "Users read own payouts" ON public.payouts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 11. subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subs" ON public.subscriptions;
CREATE POLICY "Users read own subs" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own subs" ON public.subscriptions;
CREATE POLICY "Users insert own subs" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own subs" ON public.subscriptions;
CREATE POLICY "Users update own subs" ON public.subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 12. scan_runs
ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own scans" ON public.scan_runs;
CREATE POLICY "Users read own scans" ON public.scan_runs FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own scans" ON public.scan_runs;
CREATE POLICY "Users insert own scans" ON public.scan_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 13. alerts
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own alerts" ON public.alerts;
CREATE POLICY "Users read own alerts" ON public.alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own alerts" ON public.alerts;
CREATE POLICY "Users update own alerts" ON public.alerts FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 14. settlement_matches
ALTER TABLE public.settlement_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own matches" ON public.settlement_matches;
CREATE POLICY "Users read own matches" ON public.settlement_matches FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 15. user_risk_snapshots
ALTER TABLE public.user_risk_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own risk" ON public.user_risk_snapshots;
CREATE POLICY "Users read own risk" ON public.user_risk_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 16. scan_schedule
ALTER TABLE public.scan_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own schedule" ON public.scan_schedule;
CREATE POLICY "Users read own schedule" ON public.scan_schedule FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own schedule" ON public.scan_schedule;
CREATE POLICY "Users insert own schedule" ON public.scan_schedule FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own schedule" ON public.scan_schedule;
CREATE POLICY "Users update own schedule" ON public.scan_schedule FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 17. user_referrals
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own referrals" ON public.user_referrals;
CREATE POLICY "Users read own referrals" ON public.user_referrals FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert referrals" ON public.user_referrals;
CREATE POLICY "Users insert referrals" ON public.user_referrals FOR INSERT TO authenticated WITH CHECK (true);

-- 18. data_deletion_requests
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Users read own deletion requests" ON public.data_deletion_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Users insert own deletion requests" ON public.data_deletion_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 19. claim_services
ALTER TABLE public.claim_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own services" ON public.claim_services;
CREATE POLICY "Users read own services" ON public.claim_services FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own services" ON public.claim_services;
CREATE POLICY "Users insert own services" ON public.claim_services FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 20. upsell_clicks
ALTER TABLE public.upsell_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own clicks" ON public.upsell_clicks;
CREATE POLICY "Users insert own clicks" ON public.upsell_clicks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users read own clicks" ON public.upsell_clicks;
CREATE POLICY "Users read own clicks" ON public.upsell_clicks FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 21. claim_status_history
ALTER TABLE public.claim_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own claim history" ON public.claim_status_history;
CREATE POLICY "Users read own claim history" ON public.claim_status_history FOR SELECT TO authenticated
  USING (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own claim history" ON public.claim_status_history;
CREATE POLICY "Users insert own claim history" ON public.claim_status_history FOR INSERT TO authenticated
  WITH CHECK (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));

-- 22. claim_payout_events
ALTER TABLE public.claim_payout_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payout events" ON public.claim_payout_events;
CREATE POLICY "Users read own payout events" ON public.claim_payout_events FOR SELECT TO authenticated
  USING (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));

-- 23. notification_outbox
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notification_outbox;
CREATE POLICY "Users read own notifications" ON public.notification_outbox FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 24. scan_job_queue
ALTER TABLE public.scan_job_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own scan jobs" ON public.scan_job_queue;
CREATE POLICY "Users read own scan jobs" ON public.scan_job_queue FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 25. product_events
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own events" ON public.product_events;
CREATE POLICY "Users insert own events" ON public.product_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users read own events" ON public.product_events;
CREATE POLICY "Users read own events" ON public.product_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 26. claim_packets
ALTER TABLE public.claim_packets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own packets" ON public.claim_packets;
CREATE POLICY "Users read own packets" ON public.claim_packets FOR SELECT TO authenticated
  USING (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));

-- 27. claim_share_links
ALTER TABLE public.claim_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own share links" ON public.claim_share_links;
CREATE POLICY "Users read own share links" ON public.claim_share_links FOR SELECT TO authenticated
  USING (claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid()));

-- 28. document_ai_analysis
ALTER TABLE public.document_ai_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own doc analysis" ON public.document_ai_analysis;
CREATE POLICY "Users read own doc analysis" ON public.document_ai_analysis FOR SELECT TO authenticated
  USING (document_id IN (SELECT id FROM public.claim_documents WHERE user_id = auth.uid()));

-- 29. claim_review_queue (admin only)
ALTER TABLE public.claim_review_queue ENABLE ROW LEVEL SECURITY;

-- 30. fraud_flags (admin only)
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
