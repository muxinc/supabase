-- Row Level Security (RLS) policies
-- Enforces access control at the database level

-- Enable RLS on all Mux tables
alter table "mux"."assets" enable row level security;
alter table "mux"."live_streams" enable row level security;
alter table "mux"."uploads" enable row level security;
alter table "mux"."webhook_events" enable row level security;

-- Block all direct client access (data should only be accessed through API)
create policy "Block all client access" on "mux"."assets"
    for all using (false);

create policy "Block all client access" on "mux"."live_streams"
    for all using (false);

create policy "Block all client access" on "mux"."uploads"
    for all using (false);

create policy "Block all client access" on "mux"."webhook_events"
    for all using (false);
