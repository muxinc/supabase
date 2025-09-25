-- Table definition for Mux Uploads
-- Contains direct upload configurations and their processing status

create table if not exists "mux"."uploads" (
    id text primary key,
    status text,
    timeout_seconds integer,
    asset_id text,
    cors_origin text,
    url text,
    error jsonb default '{}'::jsonb,
    test boolean default false
);
