create table if not exists "mux"."live_streams" (
    id uuid primary key default gen_random_uuid(),
    mux_live_stream_id text unique not null,
    status text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    stream_key text not null,
    active_asset_id text references "mux"."assets"(mux_asset_id) on delete set null,
    recent_asset_ids jsonb default '[]'::jsonb,
    playback_ids jsonb default '[]'::jsonb,
    new_asset_settings jsonb default '{}'::jsonb,
    passthrough text,
    audio_only boolean default false,
    embedded_subtitles jsonb default '[]'::jsonb,
    generated_subtitles jsonb default '[]'::jsonb,
    latency_mode text not null,
    test boolean default false,
    max_continuous_duration integer not null,
    reconnect_window decimal,
    use_slate_for_standard_latency boolean default false,
    reconnect_slate_url text,
    target_latency decimal,
    active_ingest_protocol text,
    meta jsonb default '{}'::jsonb,
    simulcast_targets jsonb default '[]'::jsonb,
    srt_passphrase text,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_mux_live_streams_mux_live_stream_id on "mux"."live_streams"(mux_live_stream_id);
create index if not exists idx_mux_live_streams_status on "mux"."live_streams"(status);
create index if not exists idx_mux_live_streams_created_at on "mux"."live_streams"(created_at);
create index if not exists idx_mux_live_streams_updated_at on "mux"."live_streams"(updated_at);
create index if not exists idx_mux_live_streams_active_asset_id on "mux"."live_streams"(active_asset_id);

create trigger update_mux_live_streams_updated_at
    before update on "mux"."live_streams"
    for each row
    execute function update_updated_at_column();

alter table "mux"."live_streams" enable row level security;

create policy "Block all client access" on "mux"."live_streams"
    for all using (false);