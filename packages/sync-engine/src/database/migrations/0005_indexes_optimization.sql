-- Optimization 1: Composite Indexes for status + date queries
-- These are very common query patterns in sync engines

-- Assets: Status + created_at (for filtering by status and date range)
CREATE INDEX IF NOT EXISTS idx_mux_assets_status_created_at 
ON "mux"."assets"(status, created_at);

-- Live Streams: Status + created_at
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_status_created_at 
ON "mux"."live_streams"(status, created_at);

-- Only status-based index is needed for uploads
CREATE INDEX IF NOT EXISTS idx_mux_uploads_status 
ON "mux"."uploads"(status);


-- Optimization 2: GIN Indexes for JSONB fields
-- Essential for searching within JSON fields

-- Assets JSONB fields
CREATE INDEX IF NOT EXISTS idx_mux_assets_playback_ids_gin 
ON "mux"."assets" USING gin(playback_ids);

CREATE INDEX IF NOT EXISTS idx_mux_assets_errors_gin 
ON "mux"."assets" USING gin(errors);

CREATE INDEX IF NOT EXISTS idx_mux_assets_tracks_gin 
ON "mux"."assets" USING gin(tracks);

CREATE INDEX IF NOT EXISTS idx_mux_assets_meta_gin 
ON "mux"."assets" USING gin(meta);

CREATE INDEX IF NOT EXISTS idx_mux_assets_input_info_gin 
ON "mux"."assets" USING gin(input_info);

CREATE INDEX IF NOT EXISTS idx_mux_assets_static_renditions_gin 
ON "mux"."assets" USING gin(static_renditions);

-- Live Streams JSONB fields
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_playback_ids_gin 
ON "mux"."live_streams" USING gin(playback_ids);

CREATE INDEX IF NOT EXISTS idx_mux_live_streams_recent_asset_ids_gin 
ON "mux"."live_streams" USING gin(recent_asset_ids);

CREATE INDEX IF NOT EXISTS idx_mux_live_streams_meta_gin 
ON "mux"."live_streams" USING gin(meta);

CREATE INDEX IF NOT EXISTS idx_mux_live_streams_simulcast_targets_gin 
ON "mux"."live_streams" USING gin(simulcast_targets);

-- Uploads JSONB fields
CREATE INDEX IF NOT EXISTS idx_mux_uploads_error_gin 
ON "mux"."uploads" USING gin(error);


-- Optimization 3: Partial Indexes for common filtering scenarios
-- These indexes only include rows that match specific conditions, making them smaller and faster

-- Assets without errors (successful assets)
CREATE INDEX IF NOT EXISTS idx_mux_assets_successful 
ON "mux"."assets"(status, created_at) 
WHERE errors = '[]'::jsonb AND status IN ('ready');

-- Assets with errors (for error monitoring)
CREATE INDEX IF NOT EXISTS idx_mux_assets_with_errors 
ON "mux"."assets"(status, created_at) 
WHERE errors != '[]'::jsonb OR status = 'errored';

-- Live assets only (performance optimization for live content)
CREATE INDEX IF NOT EXISTS idx_mux_assets_live_only 
ON "mux"."assets"(status, created_at, live_stream_id) 
WHERE is_live = true;

-- Active live streams (most common query for live streaming)
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_active 
ON "mux"."live_streams"(created_at, active_asset_id) 
WHERE status IN ('active', 'idle');


-- Assets by ingest type (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_mux_assets_by_ingest_type 
ON "mux"."assets"(ingest_type, created_at) 
WHERE ingest_type IS NOT NULL;
