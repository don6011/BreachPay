
-- =========================================================
-- SETTLEMENT INGESTION ENGINE
-- =========================================================

-- 1) settlement_sources
CREATE TABLE public.settlement_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('claims_admin','court','law_firm','aggregator','manual')),
  base_url text,
  reliability_score int DEFAULT 70,
  is_active boolean DEFAULT true,
  fetch_strategy text DEFAULT 'manual' CHECK (fetch_strategy IN ('manual','edge_function','import_csv')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settlement_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_admin_all" ON public.settlement_sources FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "ss_read_auth" ON public.settlement_sources FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2) settlement_raw_ingest
CREATE TABLE public.settlement_raw_ingest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.settlement_sources(id),
  source_record_id text,
  raw_url text,
  raw_payload jsonb NOT NULL,
  content_hash text NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, content_hash)
);
ALTER TABLE public.settlement_raw_ingest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sri_admin_all" ON public.settlement_raw_ingest FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 3) Convert settlement status from enum to text
ALTER TABLE public.settlement_matches ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.settlement_matches ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.settlement_matches ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE public.settlements ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.settlements ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.settlements ALTER COLUMN status SET DEFAULT 'pending_review';

DROP TYPE IF EXISTS public.settlement_status_t;

-- 4) Add new columns to settlements
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS category text DEFAULT 'data_breach';
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS final_approval_date date;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS eligibility_summary text;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS claim_url text;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.settlement_sources(id);
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS canonical_key text;

-- Backfill canonical_key for existing rows (handle potential duplicates)
WITH ranked AS (
  SELECT id,
    lower(regexp_replace(
      company || ':' || name || ':' || coalesce(claim_deadline::text, coalesce(deadline::text, '')),
      '[^a-z0-9:]', '', 'gi'
    )) AS base_key,
    ROW_NUMBER() OVER (
      PARTITION BY lower(regexp_replace(
        company || ':' || name || ':' || coalesce(claim_deadline::text, coalesce(deadline::text, '')),
        '[^a-z0-9:]', '', 'gi'
      ))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.settlements
  WHERE canonical_key IS NULL
)
UPDATE public.settlements s
SET canonical_key = CASE WHEN r.rn = 1 THEN r.base_key ELSE r.base_key || ':' || r.rn END
FROM ranked r
WHERE s.id = r.id;

ALTER TABLE public.settlements ALTER COLUMN canonical_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_canonical_key ON public.settlements(canonical_key);

-- 5) settlement_verification_queue
CREATE TABLE public.settlement_verification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  priority int DEFAULT 50,
  reason text DEFAULT 'new',
  status text DEFAULT 'open' CHECK (status IN ('open','approved','rejected')),
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_svq_one_open ON public.settlement_verification_queue(settlement_id) WHERE status = 'open';
ALTER TABLE public.settlement_verification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svq_admin_all" ON public.settlement_verification_queue FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 6) Normalization function
CREATE OR REPLACE FUNCTION public.normalize_raw_ingest(p_ingest_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw record;
  v_key text;
  v_name text;
  v_company text;
  v_deadline date;
  v_settlement_id uuid;
BEGIN
  SELECT * INTO v_raw FROM public.settlement_raw_ingest WHERE id = p_ingest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ingest row not found: %', p_ingest_id; END IF;

  v_name := coalesce(v_raw.raw_payload->>'name', '');
  v_company := coalesce(v_raw.raw_payload->>'company', '');
  v_deadline := (v_raw.raw_payload->>'claim_deadline')::date;
  v_key := lower(regexp_replace(
    v_company || ':' || v_name || ':' || coalesce(v_deadline::text, ''),
    '[^a-z0-9:]', '', 'gi'
  ));

  SELECT id INTO v_settlement_id FROM public.settlements WHERE canonical_key = v_key;

  IF v_settlement_id IS NOT NULL THEN
    UPDATE public.settlements SET
      name = coalesce(nullif(v_name,''), name),
      company = coalesce(nullif(v_company,''), company),
      claim_deadline = coalesce(v_deadline, claim_deadline),
      deadline = coalesce(v_deadline, deadline),
      payout_min = coalesce((v_raw.raw_payload->>'payout_min')::numeric, payout_min),
      payout_max = coalesce((v_raw.raw_payload->>'payout_max')::numeric, payout_max),
      eligibility_summary = coalesce(v_raw.raw_payload->>'eligibility_summary', eligibility_summary),
      claim_url = coalesce(v_raw.raw_payload->>'claim_url', claim_url),
      description = coalesce(v_raw.raw_payload->>'description', description),
      source_id = coalesce(v_raw.source_id, source_id),
      source_url = coalesce(v_raw.raw_url, source_url),
      category = coalesce(v_raw.raw_payload->>'category', category),
      breach_year = coalesce((v_raw.raw_payload->>'breach_year')::int, breach_year),
      status = 'pending_review',
      updated_at = now()
    WHERE id = v_settlement_id;

    INSERT INTO public.settlement_verification_queue(settlement_id, reason, priority)
    VALUES (v_settlement_id, 'changed', 70)
    ON CONFLICT (settlement_id) WHERE status = 'open'
    DO UPDATE SET reason = 'changed', priority = 70;

    RETURN v_settlement_id;
  ELSE
    INSERT INTO public.settlements(
      name, company, claim_deadline, deadline, payout_min, payout_max,
      eligibility_summary, claim_url, description, source_id, source_url,
      canonical_key, status, category, breach_year
    ) VALUES (
      v_name, v_company, v_deadline, v_deadline,
      (v_raw.raw_payload->>'payout_min')::numeric,
      (v_raw.raw_payload->>'payout_max')::numeric,
      v_raw.raw_payload->>'eligibility_summary',
      v_raw.raw_payload->>'claim_url',
      v_raw.raw_payload->>'description',
      v_raw.source_id, v_raw.raw_url,
      v_key, 'pending_review',
      coalesce(v_raw.raw_payload->>'category', 'data_breach'),
      (v_raw.raw_payload->>'breach_year')::int
    )
    RETURNING id INTO v_settlement_id;

    INSERT INTO public.settlement_verification_queue(settlement_id, reason)
    VALUES (v_settlement_id, 'new');

    RETURN v_settlement_id;
  END IF;
END;
$$;

-- 7) Seed: 6 sources
INSERT INTO public.settlement_sources (name, type, base_url, reliability_score, fetch_strategy) VALUES
  ('TopClassActions.com', 'aggregator', 'https://topclassactions.com', 65, 'manual'),
  ('ClassAction.org', 'aggregator', 'https://classaction.org', 60, 'manual'),
  ('PACER / US Courts', 'court', 'https://pacer.uscourts.gov', 95, 'manual'),
  ('Kroll Settlement Administration', 'claims_admin', 'https://www.krollsettlementadministration.com', 90, 'manual'),
  ('Epiq Global', 'claims_admin', 'https://www.epiqglobal.com', 90, 'manual'),
  ('Manual Entry', 'manual', NULL, 50, 'manual');

-- 8) Seed: 20 raw ingest records
INSERT INTO public.settlement_raw_ingest (source_id, source_record_id, raw_url, raw_payload, content_hash) VALUES
(
  (SELECT id FROM public.settlement_sources WHERE name='TopClassActions.com'),
  'tca-tmobile-2021', 'https://topclassactions.com/t-mobile-data-breach',
  '{"name":"T-Mobile Data Breach Settlement","company":"T-Mobile","breach_year":2021,"claim_deadline":"2026-07-15","payout_min":25,"payout_max":100,"eligibility_summary":"Affected customers whose personal data was exposed in the August 2021 breach.","claim_url":"https://www.t-mobilesettlement.com","description":"$350M settlement for the 2021 data breach affecting 76M customers.","category":"data_breach"}'::jsonb,
  md5('tca-tmobile-2021')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='PACER / US Courts'),
  'pacer-equifax-2017', 'https://www.equifaxbreachsettlement.com',
  '{"name":"Equifax Data Breach Settlement","company":"Equifax","breach_year":2017,"claim_deadline":"2026-09-30","payout_min":125,"payout_max":500,"eligibility_summary":"US consumers with Equifax credit files as of Sept 2017.","claim_url":"https://www.equifaxbreachsettlement.com/file-a-claim","description":"$700M settlement for the massive 2017 breach exposing 147M consumers.","category":"data_breach"}'::jsonb,
  md5('pacer-equifax-2017')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Kroll Settlement Administration'),
  'kroll-capitalone-2019', 'https://www.capitalonesettlement.com',
  '{"name":"Capital One Data Breach Settlement","company":"Capital One","breach_year":2019,"claim_deadline":"2026-06-01","payout_min":25,"payout_max":250,"eligibility_summary":"Capital One customers or applicants affected by the 2019 breach.","claim_url":"https://www.capitalonesettlement.com","description":"$190M settlement for the 2019 breach affecting 100M+ applicants.","category":"data_breach"}'::jsonb,
  md5('kroll-capitalone-2019')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='ClassAction.org'),
  'ca-yahoo-2013', 'https://classaction.org/yahoo-data-breach',
  '{"name":"Yahoo Data Breach Settlement","company":"Yahoo","breach_year":2013,"claim_deadline":"2026-05-01","payout_min":100,"payout_max":375,"eligibility_summary":"US Yahoo account holders between 2012-2016.","claim_url":"https://yahoodatabreachsettlement.com","description":"$117.5M settlement covering 3 billion compromised accounts.","category":"data_breach"}'::jsonb,
  md5('ca-yahoo-2013')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Epiq Global'),
  'epiq-marriott-2018', 'https://www.marriottbreachsettlement.com',
  '{"name":"Marriott/Starwood Data Breach Settlement","company":"Marriott","breach_year":2018,"claim_deadline":"2026-08-15","payout_min":25,"payout_max":300,"eligibility_summary":"Starwood guests who made reservations before Sept 10, 2018.","claim_url":"https://www.marriottbreachsettlement.com","description":"$52M settlement for the Starwood reservation system breach.","category":"data_breach"}'::jsonb,
  md5('epiq-marriott-2018')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='TopClassActions.com'),
  'tca-homedepot-2014', 'https://topclassactions.com/home-depot-breach',
  '{"name":"Home Depot Data Breach Settlement","company":"Home Depot","breach_year":2014,"claim_deadline":"2026-04-30","payout_min":15,"payout_max":200,"eligibility_summary":"Home Depot customers who used payment cards at US/Canadian stores in 2014.","claim_url":"https://homedepotbreachsettlement.com","description":"$200M settlement for POS malware breach affecting 56M cards.","category":"data_breach"}'::jsonb,
  md5('tca-homedepot-2014')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='PACER / US Courts'),
  'pacer-anthem-2015', 'https://www.anthembreachsettlement.com',
  '{"name":"Anthem Data Breach Settlement","company":"Anthem","breach_year":2015,"claim_deadline":"2026-11-01","payout_min":50,"payout_max":500,"eligibility_summary":"Anthem health plan members whose data was compromised in the 2015 breach.","claim_url":"https://www.anthembreachsettlement.com","description":"$115M settlement for healthcare breach affecting 78.8M members.","category":"data_breach"}'::jsonb,
  md5('pacer-anthem-2015')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='ClassAction.org'),
  'ca-target-2013', 'https://classaction.org/target-data-breach',
  '{"name":"Target Data Breach Settlement","company":"Target","breach_year":2013,"claim_deadline":"2026-03-31","payout_min":10,"payout_max":100,"eligibility_summary":"Target customers who made purchases during Nov-Dec 2013 holiday season.","claim_url":"https://targetbreachsettlement.com","description":"$18.5M settlement for holiday season POS breach affecting 41M cards.","category":"data_breach"}'::jsonb,
  md5('ca-target-2013')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='TopClassActions.com'),
  'tca-uber-2016', 'https://topclassactions.com/uber-breach',
  '{"name":"Uber Data Breach Settlement","company":"Uber","breach_year":2016,"claim_deadline":"2026-10-15","payout_min":50,"payout_max":500,"eligibility_summary":"Uber drivers and riders whose data was exposed in the 2016 breach.","claim_url":"https://ubersettlement.com","description":"$148M settlement for concealed breach affecting 57M users and 600K drivers.","category":"data_breach"}'::jsonb,
  md5('tca-uber-2016')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Kroll Settlement Administration'),
  'kroll-mgm-2019', 'https://www.mgmresortssettlement.com',
  '{"name":"MGM Resorts Data Breach Settlement","company":"MGM Resorts","breach_year":2019,"claim_deadline":"2026-07-01","payout_min":20,"payout_max":150,"eligibility_summary":"MGM Resorts guests whose data was exposed in the cloud server breach.","claim_url":"https://mgmresortssettlement.com","description":"$45M settlement for breach exposing 10.6M guest records.","category":"data_breach"}'::jsonb,
  md5('kroll-mgm-2019')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Epiq Global'),
  'epiq-cashapp-2022', 'https://www.cashappsettlement.com',
  '{"name":"Cash App Data Breach Settlement","company":"Block (Cash App)","breach_year":2022,"claim_deadline":"2026-12-01","payout_min":25,"payout_max":250,"eligibility_summary":"Cash App Investing users whose data was accessed by a former employee.","claim_url":"https://cashappsettlement.com","description":"$15M settlement for insider breach affecting 8.2M users.","category":"data_breach"}'::jsonb,
  md5('epiq-cashapp-2022')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='TopClassActions.com'),
  'tca-lastpass-2022', 'https://topclassactions.com/lastpass-breach',
  '{"name":"LastPass Data Breach Settlement","company":"LastPass","breach_year":2022,"claim_deadline":"2026-08-01","payout_min":50,"payout_max":500,"eligibility_summary":"LastPass users whose vault data was compromised in the 2022 breaches.","claim_url":"https://lastpasssettlement.com","description":"Proposed settlement for breach exposing encrypted password vaults.","category":"data_breach"}'::jsonb,
  md5('tca-lastpass-2022')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='PACER / US Courts'),
  'pacer-att-2024', 'https://www.attsettlement.com',
  '{"name":"AT&T Data Breach Settlement","company":"AT&T","breach_year":2024,"claim_deadline":"2026-09-01","payout_min":15,"payout_max":100,"eligibility_summary":"AT&T customers whose call and text records were exposed via Snowflake.","claim_url":"https://attsettlement.com","description":"$13M settlement for 2024 breach affecting 73M customer records.","category":"data_breach"}'::jsonb,
  md5('pacer-att-2024')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='ClassAction.org'),
  'ca-23andme-2023', 'https://classaction.org/23andme-breach',
  '{"name":"23andMe Data Breach Settlement","company":"23andMe","breach_year":2023,"claim_deadline":"2026-06-15","payout_min":25,"payout_max":200,"eligibility_summary":"23andMe users whose genetic and profile data was exposed via credential stuffing.","claim_url":"https://23andmesettlement.com","description":"$30M settlement for breach exposing 6.9M user profiles and genetic data.","category":"data_breach"}'::jsonb,
  md5('ca-23andme-2023')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Kroll Settlement Administration'),
  'kroll-moveit-2023', 'https://www.moveitsettlement.com',
  '{"name":"MOVEit Transfer Data Breach Settlement","company":"Progress Software","breach_year":2023,"claim_deadline":"2026-05-15","payout_min":20,"payout_max":150,"eligibility_summary":"Individuals whose data was exposed through MOVEit Transfer vulnerabilities.","claim_url":"https://moveitsettlement.com","description":"$10M settlement for zero-day exploit affecting 2,500+ organizations.","category":"data_breach"}'::jsonb,
  md5('kroll-moveit-2023')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='TopClassActions.com'),
  'tca-ticketmaster-2024', 'https://topclassactions.com/ticketmaster-breach',
  '{"name":"Ticketmaster Data Breach Settlement","company":"Ticketmaster","breach_year":2024,"claim_deadline":"2026-11-15","payout_min":20,"payout_max":250,"eligibility_summary":"Ticketmaster customers whose payment and personal data was exposed.","claim_url":"https://ticketmastersettlement.com","description":"Proposed settlement for breach affecting 560M customer records via Snowflake.","category":"data_breach"}'::jsonb,
  md5('tca-ticketmaster-2024')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Epiq Global'),
  'epiq-npd-2024', 'https://www.npdsettlement.com',
  '{"name":"National Public Data Breach Settlement","company":"National Public Data","breach_year":2024,"claim_deadline":"2026-10-01","payout_min":10,"payout_max":100,"eligibility_summary":"US citizens whose SSN, address, and records were exposed in the NPD breach.","claim_url":"https://npdsettlement.com","description":"Pending settlement for breach exposing 2.9B records with SSNs.","category":"data_breach"}'::jsonb,
  md5('epiq-npd-2024')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='PACER / US Courts'),
  'pacer-change-2024', 'https://www.changehealthcaresettlement.com',
  '{"name":"Change Healthcare Data Breach Settlement","company":"Change Healthcare","breach_year":2024,"claim_deadline":"2026-12-15","payout_min":50,"payout_max":500,"eligibility_summary":"Patients whose health records were exposed in the ransomware attack.","claim_url":"https://changehealthcaresettlement.com","description":"Proposed settlement for breach affecting 100M patient records.","category":"data_breach"}'::jsonb,
  md5('pacer-change-2024')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='ClassAction.org'),
  'ca-facebook-2019', 'https://classaction.org/facebook-privacy',
  '{"name":"Facebook Privacy Settlement","company":"Meta (Facebook)","breach_year":2019,"claim_deadline":"2026-04-15","payout_min":25,"payout_max":300,"eligibility_summary":"US Facebook users between May 2007 and December 2022.","claim_url":"https://facebookuserprivacysettlement.com","description":"$725M settlement for Cambridge Analytica privacy violations.","category":"privacy"}'::jsonb,
  md5('ca-facebook-2019')
),
(
  (SELECT id FROM public.settlement_sources WHERE name='Kroll Settlement Administration'),
  'kroll-google-2018', 'https://www.googlesettlement.com',
  '{"name":"Google+ Data Breach Settlement","company":"Google","breach_year":2018,"claim_deadline":"2026-03-15","payout_min":5,"payout_max":50,"eligibility_summary":"Google+ users whose profile data was exposed through API bugs.","claim_url":"https://googlesettlement.com","description":"$7.5M settlement for Google+ API exposure affecting 500K users.","category":"data_breach"}'::jsonb,
  md5('kroll-google-2018')
);

-- 9) Run normalization on all seed records
SELECT public.normalize_raw_ingest(id) FROM public.settlement_raw_ingest;

-- 10) Mark first 10 as verified (for demo)
UPDATE public.settlements SET status = 'verified', verified = true, verification_level = 'source_linked'
WHERE canonical_key IN (
  SELECT lower(regexp_replace(
    (raw_payload->>'company') || ':' || (raw_payload->>'name') || ':' || coalesce(raw_payload->>'claim_deadline',''),
    '[^a-z0-9:]', '', 'gi'
  ))
  FROM public.settlement_raw_ingest
  ORDER BY created_at ASC
  LIMIT 10
);

-- Update verification queue for approved items
UPDATE public.settlement_verification_queue SET status = 'approved', reviewed_at = now()
WHERE settlement_id IN (SELECT id FROM public.settlements WHERE status = 'verified')
  AND status = 'open';
