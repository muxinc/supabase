-- Table definition for Mux Uploads
-- Contains direct upload configurations and their processing status

create table if not exists "mux"."uploads" (
    id uuid primary key default gen_random_uuid(),
    mux_upload_id text unique not null,
    status text not null,
    timeout integer,
    asset_id text unique references "mux"."assets"(mux_asset_id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    cors_origin text,
    url text,
    error jsonb default '{}'::jsonb,
    test boolean default false
);
