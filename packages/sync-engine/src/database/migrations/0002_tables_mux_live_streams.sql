-- Table definition for Mux Live Streams
-- Contains live streaming configurations and their current state

create table if not exists "mux"."live_streams" (
    id uuid primary key default gen_random_uuid(),
    mux_live_stream_id text unique not null,
    status text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    stream_key text,
    active_asset_id text references "mux"."assets"(mux_asset_id) on delete set null,
    recent_asset_ids jsonb default '[]'::jsonb,
    playback_ids jsonb default '[]'::jsonb,
    new_asset_settings jsonb default '{}'::jsonb,
    passthrough text,
    audio_only boolean default false,
    embedded_subtitles jsonb default '[]'::jsonb,
    generated_subtitles jsonb default '[]'::jsonb,
    latency_mode text,
    test boolean default false,
    max_continuous_duration integer,
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
