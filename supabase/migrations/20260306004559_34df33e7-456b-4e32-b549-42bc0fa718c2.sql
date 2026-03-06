-- Fix: default claim status should be 'draft', not 'submitted'
ALTER TABLE public.claims ALTER COLUMN status SET DEFAULT 'draft'::claim_status_t;