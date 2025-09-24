-- Table definition for Mux Live Streams
-- Contains live streaming configurations and their current state

create table if not exists "mux"."live_streams" (
    id text primary key,
    status text,
    created_at timestamp with time zone,
    stream_key text,
    active_asset_id text,
    recent_asset_ids jsonb default '[]'::jsonb,
    playback_ids jsonb default '[]'::jsonb,
    new_asset_settings jsonb default '{}'::jsonb,
    passthrough text,
    audio_only boolean default false,
    embedded_subtitles jsonb default '[]'::jsonb,
    generated_subtitles jsonb default '[]'::jsonb,
    latency_mode text,
    test boolean default false,
    max_continuous_duration_seconds integer,
    reconnect_window_seconds decimal,
    use_slate_for_standard_latency boolean default false,
    reconnect_slate_url text,
    active_ingest_protocol text,
    meta jsonb default '{}'::jsonb,
    simulcast_targets jsonb default '[]'::jsonb,
    srt_passphrase text
);
