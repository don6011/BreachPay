
-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily settlement discovery at 3:00 AM UTC
SELECT cron.schedule(
  'daily-settlement-discovery',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/run-settlement-discovery',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptamlraXRobGF4ZWxkdnNta2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODg3ODAsImV4cCI6MjA4NjU2NDc4MH0.HPm-cHkUTEa7qIMdMtDo4pwk5K9mGyQTHoxH9hPnhhQ"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
