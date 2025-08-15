create table if not exists "mux"."uploads" (
    id uuid primary key default gen_random_uuid(),
    mux_upload_id text unique not null,
    status text not null,
    timeout integer not null,
    asset_id text unique references "mux"."assets"(mux_asset_id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    cors_origin text unique not null,
    url text not null,
    error jsonb default '{}'::jsonb,
    test boolean default false
);

create index if not exists idx_mux_uploads_mux_upload_id on "mux"."uploads"(mux_upload_id);
create index if not exists idx_mux_uploads_status on "mux"."uploads"(status);
create index if not exists idx_mux_uploads_created_at on "mux"."uploads"(created_at);
create index if not exists idx_mux_uploads_updated_at on "mux"."uploads"(updated_at);
create index if not exists idx_mux_uploads_asset_id on "mux"."uploads"(asset_id);

create trigger update_mux_uploads_updated_at
    before update on "mux"."uploads"
    for each row
    execute function update_updated_at_column();

alter table "mux"."uploads" enable row level security;

create policy "Block all client access" on "mux"."uploads"
    for all using (false);


