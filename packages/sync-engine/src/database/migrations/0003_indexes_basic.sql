-- Basic indexes for essential queries (Foreign Key relationships only)

create index if not exists idx_mux_assets_live_stream_id on "mux"."assets"(live_stream_id);

create index if not exists idx_mux_live_streams_active_asset_id on "mux"."live_streams"(active_asset_id);

create index if not exists idx_mux_uploads_asset_id on "mux"."uploads"(asset_id);
