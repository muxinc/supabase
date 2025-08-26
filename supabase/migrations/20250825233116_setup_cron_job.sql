-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;


-- Create the cron job
SELECT cron.schedule(
  'process-queue-cron',
  '*/10 * * * * *', -- Every 10s
  $$
  SELECT net.http_post(
    url := 'https://3ee2a5a047b2.ngrok-free.app/functions/v1/process-queue-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer '
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);
