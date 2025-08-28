-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Create the cron job
SELECT cron.schedule(
  'process-queue-cron',
  '10 seconds', -- Every 10s
  $$
  SELECT net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/process-queue-cron',
    headers:=jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer: ' || (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);
