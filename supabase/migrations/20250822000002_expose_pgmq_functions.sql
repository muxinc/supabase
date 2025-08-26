-- Expose pgmq functions to the public schema for RPC access

-- Create wrapper functions in public schema to expose pgmq functions
CREATE OR REPLACE FUNCTION public.pgmq_read(
  queue_name text,
  visibility_timeout integer default 30,
  qty integer default 1
)
RETURNS TABLE (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamp with time zone,
  vt timestamp with time zone,
  message jsonb
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.read(queue_name, visibility_timeout, qty);
END;
$$;

CREATE OR REPLACE FUNCTION public.pgmq_pop(queue_name text)
RETURNS TABLE (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamp with time zone,
  vt timestamp with time zone,
  message jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.pop(queue_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.pgmq_archive(
  queue_name text,
  msg_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN pgmq.archive(queue_name, msg_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pgmq_send(
  queue_name text,
  message jsonb,
  delay integer default 0
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN pgmq.send(queue_name, message, delay);
END;
$$;