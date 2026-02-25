
-- Remove old dispatch-outbox cron job and create new one for dispatch-notifications
SELECT cron.unschedule(29);

SELECT cron.schedule(
  'dispatch_notifications_2m',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/dispatch-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptamlraXRobGF4ZWxkdnNta2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODg3ODAsImV4cCI6MjA4NjU2NDc4MH0.HPm-cHkUTEa7qIMdMtDo4pwk5K9mGyQTHoxH9hPnhhQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
