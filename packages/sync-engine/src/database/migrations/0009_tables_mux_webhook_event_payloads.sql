-- Table definition for Mux Webhook Event Payloads
-- Contains the raw payload data for webhook events

create table if not exists "mux"."webhook_event_payloads" (
    webhook_event_id text primary key references "mux"."webhook_events"(id) on delete cascade,
    raw_body jsonb,
    headers jsonb
);