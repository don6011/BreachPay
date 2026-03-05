
-- Schedule daily archive of expired settlements at 2:00 AM UTC
SELECT cron.schedule(
  'daily-archive-expired-settlements',
  '0 2 * * *',
  $$ SELECT public.proc_archive_expired_settlements(); $$
);
