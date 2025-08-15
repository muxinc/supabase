-- Basic indexes for essential queries
-- These provide fundamental performance for common lookup patterns

-- Mux Assets basic indexes
create index if not exists idx_mux_assets_mux_asset_id on "mux"."assets"(mux_asset_id);
create index if not exists idx_mux_assets_status on "mux"."assets"(status);
create index if not exists idx_mux_assets_created_at on "mux"."assets"(created_at);
create index if not exists idx_mux_assets_updated_at on "mux"."assets"(updated_at);
create index if not exists idx_mux_assets_live_stream_id on "mux"."assets"(live_stream_id);

-- Mux Live Streams basic indexes
create index if not exists idx_mux_live_streams_mux_live_stream_id on "mux"."live_streams"(mux_live_stream_id);
create index if not exists idx_mux_live_streams_status on "mux"."live_streams"(status);
create index if not exists idx_mux_live_streams_created_at on "mux"."live_streams"(created_at);
create index if not exists idx_mux_live_streams_updated_at on "mux"."live_streams"(updated_at);
create index if not exists idx_mux_live_streams_active_asset_id on "mux"."live_streams"(active_asset_id);

-- Mux Uploads basic indexes
create index if not exists idx_mux_uploads_mux_upload_id on "mux"."uploads"(mux_upload_id);
create index if not exists idx_mux_uploads_status on "mux"."uploads"(status);
create index if not exists idx_mux_uploads_created_at on "mux"."uploads"(created_at);
create index if not exists idx_mux_uploads_updated_at on "mux"."uploads"(updated_at);
create index if not exists idx_mux_uploads_asset_id on "mux"."uploads"(asset_id);
