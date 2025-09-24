-- Reduced number of GIN indexes to minimize impact on insert/update performance

-- B-Tree Indexes

-- Assets
CREATE INDEX IF NOT EXISTS idx_mux_assets_errors_created_at
ON "mux"."assets"(created_at, status, errors);

CREATE INDEX IF NOT EXISTS idx_mux_assets_errors_status
ON "mux"."assets"(status, errors);

CREATE INDEX IF NOT EXISTS idx_mux_assets_live_only 
ON "mux"."assets"(created_at, status, live_stream_id) 
WHERE is_live = true;

-- Live Streams
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_active 
ON "mux"."live_streams"(created_at, active_asset_id, status);

CREATE INDEX IF NOT EXISTS idx_mux_live_streams_status_created_at 
ON "mux"."live_streams"(status, created_at);

-- Uploads
CREATE INDEX IF NOT EXISTS idx_mux_uploads_status 
ON "mux"."uploads"(status);

-- GIN Indexes (limited to essential JSONB fields only)

-- Assets JSONB fields
CREATE INDEX IF NOT EXISTS idx_mux_assets_playback_ids_gin 
ON "mux"."assets" USING gin(playback_ids);

CREATE INDEX IF NOT EXISTS idx_mux_assets_meta_gin 
ON "mux"."assets" USING gin(meta);

CREATE INDEX IF NOT EXISTS idx_mux_assets_input_info_gin 
ON "mux"."assets" USING gin(input_info);

CREATE INDEX IF NOT EXISTS idx_mux_assets_static_renditions_gin 
ON "mux"."assets" USING gin(static_renditions);

-- Live Streams JSONB fields
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_playback_ids_gin 
ON "mux"."live_streams" USING gin(playback_ids);

CREATE INDEX IF NOT EXISTS idx_mux_live_streams_meta_gin 
ON "mux"."live_streams" USING gin(meta);

-- Uploads JSONB fields
CREATE INDEX IF NOT EXISTS idx_mux_uploads_error_gin 
ON "mux"."uploads" USING gin(error);