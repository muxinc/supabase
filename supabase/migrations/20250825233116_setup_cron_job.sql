-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;


-- Create the cron job
SELECT cron.schedule(
  'process-queue-cron',
  '10 seconds', -- Every 10s
  $$
  SELECT net.http_post(
    url := concat(
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url'),
      '/functions/v1/process-queue-cron'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat(
        'Bearer ',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);
