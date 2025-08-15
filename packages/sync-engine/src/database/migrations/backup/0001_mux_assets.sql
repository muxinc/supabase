create table if not exists "mux"."assets" (
    id uuid primary key default gen_random_uuid(),
    mux_asset_id text unique not null,
    status text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    duration decimal,
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
    recording_times jsonb default '[]'::jsonb,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_mux_assets_mux_asset_id on "mux"."assets"(mux_asset_id);
create index if not exists idx_mux_assets_status on "mux"."assets"(status);
create index if not exists idx_mux_assets_created_at on "mux"."assets"(created_at);
create index if not exists idx_mux_assets_updated_at on "mux"."assets"(updated_at);
create index if not exists idx_mux_assets_live_stream_id on "mux"."assets"(live_stream_id);

create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language 'plpgsql';

create trigger update_mux_assets_updated_at
    before update on "mux"."assets"
    for each row
    execute function update_updated_at_column();


alter table "mux"."assets" enable row level security;


create policy "Block all client access" on "mux"."assets"
    for all using (false);