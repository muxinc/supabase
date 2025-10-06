create or replace function pgmq_public.send(queue_name text, message jsonb)
returns bigint
language sql
security definer
as $$
select pgmq.send(queue_name => queue_name, msg => message);
$$;

create or replace function pgmq_public.read(queue_name text, sleep_seconds integer default 30, n integer default 1)
returns setof pgmq.message_record
language sql
security definer
as $$
select * from pgmq.read(queue_name => queue_name, vt => sleep_seconds, qty => n);
$$;

create or replace function pgmq_public.pop(queue_name text)
returns setof pgmq.message_record
language sql
security definer
as $$
select * from pgmq.pop(queue_name => queue_name);
$$;

create or replace function pgmq_public.delete(queue_name text, msg_id bigint)
returns boolean
language sql
security definer
as $$
select pgmq.delete(queue_name => queue_name, msg_id => msg_id);
$$;

create or replace function pgmq_public.archive(queue_name text, msg_id bigint)
returns boolean
language sql
security definer
as $$
select pgmq.archive(queue_name => queue_name, msg_id => msg_id);
$$;
