-- Table definition for Mux Webhook Events
-- Contains webhook event metadata excluding the payload data

create table if not exists "mux"."webhook_events" (
    id text primary key,
    type text not null,
    created_at timestamp with time zone not null,
    attempts jsonb default '[]'::jsonb,
    environment jsonb default '{}'::jsonb,
    object jsonb default '{}'::jsonb
);
