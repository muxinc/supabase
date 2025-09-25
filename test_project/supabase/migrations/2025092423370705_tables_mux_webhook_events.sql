-- Table definition for Mux Webhook Events
-- Contains webhook event metadata and payload data

create table if not exists "mux"."webhook_events" (
    id text primary key,
    type text,
    created_at timestamp with time zone,
    attempts jsonb default '[]'::jsonb,
    environment jsonb default '{}'::jsonb,
    object jsonb default '{}'::jsonb,
    raw_body jsonb,
    headers jsonb
);
