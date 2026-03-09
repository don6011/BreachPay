-- Update settlements with realistic deadlines
-- Old breaches that should be closed (deadlines long passed)
UPDATE settlements SET 
  claim_deadline = '2020-01-22',
  deadline = '2020-01-22',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2020-01-22'::timestamptz,
  updated_at = now()
WHERE id = 'bf5f258e-fcbb-49d7-bb99-5bbf632fe73d'; -- Equifax 2017

UPDATE settlements SET 
  claim_deadline = '2015-11-30',
  deadline = '2015-11-30',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2015-11-30'::timestamptz,
  updated_at = now()
WHERE id = '6f98a64a-4386-4e43-b101-943172d675f8'; -- Target 2013

UPDATE settlements SET 
  claim_deadline = '2020-07-20',
  deadline = '2020-07-20',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2020-07-20'::timestamptz,
  updated_at = now()
WHERE id = '24db485b-9606-4267-bff4-e1f13f5bd366'; -- Yahoo 2013

UPDATE settlements SET 
  claim_deadline = '2020-03-07',
  deadline = '2020-03-07',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2020-03-07'::timestamptz,
  updated_at = now()
WHERE id = '10b8099b-1bf4-4be9-856a-98969144606f'; -- Home Depot 2014

UPDATE settlements SET 
  claim_deadline = '2021-02-19',
  deadline = '2021-02-19',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2021-02-19'::timestamptz,
  updated_at = now()
WHERE id = 'd2730a1a-4d95-4568-8037-20a930d2ea87'; -- Anthem 2015

UPDATE settlements SET 
  claim_deadline = '2023-09-30',
  deadline = '2023-09-30',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2023-09-30'::timestamptz,
  updated_at = now()
WHERE id = '3fa0cf9c-23d2-4d21-8d46-c9528489644f'; -- Capital One 2019

UPDATE settlements SET 
  claim_deadline = '2024-07-31',
  deadline = '2024-07-31',
  lifecycle_status = 'closed',
  status = 'verified',
  closed_at = '2024-07-31'::timestamptz,
  updated_at = now()
WHERE id = 'cb6a653e-227c-4f5a-b7c4-98f1afb1f288'; -- Uber 2016

-- Keep these as active with realistic future deadlines
-- T-Mobile 2021 — settlement still processing
UPDATE settlements SET 
  claim_deadline = '2026-07-15',
  deadline = '2026-07-15',
  updated_at = now()
WHERE id = 'c0a1340b-67ac-4767-8a71-94a28200a8d6'; -- T-Mobile (keep active)

-- Marriott 2018 — extended deadline
UPDATE settlements SET 
  claim_deadline = '2026-08-15',
  deadline = '2026-08-15',
  updated_at = now()
WHERE id = '0987f48f-e94d-4320-9aaa-4220eafeee71'; -- Marriott (keep active)

-- MGM 2019 — still open
UPDATE settlements SET 
  claim_deadline = '2026-07-01',
  deadline = '2026-07-01',
  updated_at = now()
WHERE id = 'a0e197b5-5b5d-40da-b1cc-5ef9c1fef816'; -- MGM (keep active);