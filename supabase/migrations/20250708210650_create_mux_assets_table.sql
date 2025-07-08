-- Create mux_assets table
CREATE TABLE mux_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mux_asset_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    duration DECIMAL,
    max_stored_resolution TEXT,
    max_stored_frame_rate DECIMAL,
    aspect_ratio TEXT,
    playback_ids JSONB DEFAULT '[]'::jsonb,
    tracks JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    master_access TEXT,
    mp4_support TEXT,
    normalize_audio BOOLEAN DEFAULT false,
    static_renditions JSONB DEFAULT '{}'::jsonb,
    test BOOLEAN DEFAULT false,
    passthrough TEXT,
    live_stream_id TEXT,
    encoding_tier TEXT,
    ingest_type TEXT,
    source_asset_id TEXT,
    per_title_encode BOOLEAN DEFAULT false,
    upload_id TEXT,
    input_info JSONB DEFAULT '{}'::jsonb,
    video_quality TEXT,
    resolution_tier TEXT,
    non_standard_input_reasons JSONB DEFAULT '[]'::jsonb,
    is_live BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_mux_assets_mux_asset_id ON mux_assets(mux_asset_id);
CREATE INDEX idx_mux_assets_status ON mux_assets(status);
CREATE INDEX idx_mux_assets_created_at ON mux_assets(created_at);
CREATE INDEX idx_mux_assets_updated_at ON mux_assets(updated_at);
CREATE INDEX idx_mux_assets_live_stream_id ON mux_assets(live_stream_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mux_assets_updated_at
    BEFORE UPDATE ON mux_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE mux_assets ENABLE ROW LEVEL SECURITY;

-- Create policy that denies all client access
CREATE POLICY "Block all client access" ON mux_assets
    FOR ALL USING (false);