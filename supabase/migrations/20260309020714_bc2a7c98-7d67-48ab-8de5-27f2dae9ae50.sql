-- 1. Delete claim-related child records first
DELETE FROM claim_status_history WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);
DELETE FROM claim_applications WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);
DELETE FROM claim_documents WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);
DELETE FROM claim_payout_events WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);
DELETE FROM claim_packets WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);
DELETE FROM claim_services WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);
DELETE FROM payouts WHERE claim_id IN (
  SELECT id FROM claims WHERE settlement_id IN (
    SELECT id FROM settlements WHERE is_demo = true OR is_test = true
  )
);

-- 2. Delete claims linked to demo settlements
DELETE FROM claims 
WHERE settlement_id IN (
  SELECT id FROM settlements WHERE is_demo = true OR is_test = true
);

-- 3. Delete settlement matches linked to demo settlements
DELETE FROM settlement_matches 
WHERE settlement_id IN (
  SELECT id FROM settlements WHERE is_demo = true OR is_test = true
);

-- 4. Delete breach events from demo scans
DELETE FROM breach_events 
WHERE scan_run_id IN (
  SELECT id FROM scan_runs WHERE provider = 'demo'
);

-- 5. Archive demo settlements
UPDATE settlements 
SET lifecycle_status = 'archived', status = 'archived'
WHERE is_demo = true OR is_test = true;