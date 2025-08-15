-- Optimization 1: Composite Indexes for status + date queries
-- These are very common query patterns in sync engines
-- Note: Using regular CREATE INDEX for migration compatibility
-- In production, these can be recreated with CONCURRENTLY if needed

-- Assets: Status + created_at (for filtering by status and date range)
CREATE INDEX IF NOT EXISTS idx_mux_assets_status_created_at 
ON "mux"."assets"(status, created_at);

-- Assets: Status + updated_at (for finding recently updated assets by status)
CREATE INDEX IF NOT EXISTS idx_mux_assets_status_updated_at 
ON "mux"."assets"(status, updated_at);

-- Live Streams: Status + created_at
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_status_created_at 
ON "mux"."live_streams"(status, created_at);

-- Live Streams: Status + updated_at
CREATE INDEX IF NOT EXISTS idx_mux_live_streams_status_updated_at 
ON "mux"."live_streams"(status, updated_at);

-- Uploads: Status + created_at
CREATE INDEX IF NOT EXISTS idx_mux_uploads_status_created_at 
ON "mux"."uploads"(status, created_at);

-- Uploads: Status + updated_at
CREATE INDEX IF NOT EXISTS idx_mux_uploads_status_updated_at 
ON "mux"."uploads"(status, updated_at);


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

-- Non-test data (production data filtering)
CREATE INDEX IF NOT EXISTS idx_mux_assets_production 
ON "mux"."assets"(status, created_at) 
WHERE test = false;

CREATE INDEX IF NOT EXISTS idx_mux_live_streams_production 
ON "mux"."live_streams"(status, created_at) 
WHERE test = false;

CREATE INDEX IF NOT EXISTS idx_mux_uploads_production 
ON "mux"."uploads"(status, created_at) 
WHERE test = false;

-- Recent uploads (for monitoring recent activity)
-- Note: Removing time-based index predicate since NOW() is not immutable
-- This index covers all uploads by status and created_at for recent activity queries
CREATE INDEX IF NOT EXISTS idx_mux_uploads_recent 
ON "mux"."uploads"(status, created_at);

-- Assets by ingest type (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_mux_assets_by_ingest_type 
ON "mux"."assets"(ingest_type, created_at) 
WHERE ingest_type IS NOT NULL;
