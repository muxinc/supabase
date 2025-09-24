-- Table definition for Mux Assets
-- Contains video assets with their metadata and processing status

create table if not exists "mux"."assets" (
    id text primary key,
    status text,
    created_at timestamp with time zone,
    duration_seconds decimal,
    max_stored_frame_rate decimal,
    aspect_ratio text,
    playback_ids jsonb default '[]'::jsonb,
    tracks jsonb default '[]'::jsonb,
    errors jsonb default '[]'::jsonb,
    master_access text,
    master jsonb default '{}'::jsonb,
    normalize_audio boolean default false,
    is_live boolean default false,
    static_renditions jsonb default '{}'::jsonb,
    test boolean default false,
    passthrough text,
    live_stream_id text,
    ingest_type text,
    source_asset_id text,
    upload_id text,
    input_info jsonb default '{}'::jsonb,
    video_quality text,
    resolution_tier text,
    non_standard_input_reasons jsonb default '[]'::jsonb,
    progress jsonb default '{}'::jsonb,
    meta jsonb default '{}'::jsonb,
    max_resolution_tier text,
    recording_times jsonb default '[]'::jsonb
);
