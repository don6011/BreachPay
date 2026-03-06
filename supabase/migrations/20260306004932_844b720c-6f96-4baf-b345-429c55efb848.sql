-- Mark original seeded settlements (status='open', no source_url) as demo data
-- so they are excluded from v_active_settlements and user-facing views
UPDATE public.settlements
SET is_demo = true, status = 'archived', lifecycle_status = 'archived'
WHERE status = 'open' AND source_url IS NULL;

-- Also clean up JND generic category pages that aren't real settlements
UPDATE public.settlements
SET is_demo = true, status = 'archived', lifecycle_status = 'archived'
WHERE name IN ('Class Action Administration', 'Corporate Restructuring', 'Government Services', 'Mass Tort')
  AND source_type = 'jnd';