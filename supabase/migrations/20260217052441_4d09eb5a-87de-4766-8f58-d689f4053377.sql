
-- Unschedule old demo scans job (jobid 23)
select cron.unschedule('demo_scheduled_scans_hourly');

-- Schedule new catalog-based scans hourly
select cron.schedule(
  'catalog_scheduled_scans_hourly',
  '0 * * * *',
  $$call public.proc_run_scheduled_scans_catalog_demo(50);$$
);
