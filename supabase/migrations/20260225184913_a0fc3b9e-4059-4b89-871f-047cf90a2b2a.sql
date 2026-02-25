-- Schedule dispatch-outbox every 2 minutes via pg_cron + pg_net
select cron.schedule(
  'dispatch_outbox_2m',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/dispatch-outbox',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptamlraXRobGF4ZWxkdnNta2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODg3ODAsImV4cCI6MjA4NjU2NDc4MH0.HPm-cHkUTEa7qIMdMtDo4pwk5K9mGyQTHoxH9hPnhhQ"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
