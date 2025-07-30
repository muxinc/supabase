-- Create mux_live_streams table
CREATE TABLE mux_live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mux_live_stream_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    stream_key TEXT,
    active_asset_id TEXT,
    recent_asset_ids JSONB DEFAULT '[]'::jsonb,
    playback_ids JSONB DEFAULT '[]'::jsonb,
    new_asset_settings JSONB DEFAULT '{}'::jsonb,
    passthrough TEXT,
    audio_only BOOLEAN DEFAULT false,
    embedded_subtitles JSONB DEFAULT '[]'::jsonb,
    generated_subtitles JSONB DEFAULT '[]'::jsonb,
    latency_mode TEXT,
    test BOOLEAN DEFAULT false,
    max_continuous_duration INTEGER,
    reconnect_window DECIMAL,
    use_slate_for_standard_latency BOOLEAN DEFAULT false,
    reconnect_slate_url TEXT,
    reduced_latency BOOLEAN DEFAULT false,
    low_latency BOOLEAN DEFAULT false,
    simulcast_targets JSONB DEFAULT '[]'::jsonb,
    target_latency DECIMAL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_mux_live_streams_mux_live_stream_id ON mux_live_streams(mux_live_stream_id);
CREATE INDEX idx_mux_live_streams_status ON mux_live_streams(status);
CREATE INDEX idx_mux_live_streams_created_at ON mux_live_streams(created_at);
CREATE INDEX idx_mux_live_streams_updated_at ON mux_live_streams(updated_at);
CREATE INDEX idx_mux_live_streams_active_asset_id ON mux_live_streams(active_asset_id);

-- Create updated_at trigger
CREATE TRIGGER update_mux_live_streams_updated_at
    BEFORE UPDATE ON mux_live_streams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE mux_live_streams ENABLE ROW LEVEL SECURITY;

-- Create policy that denies all client access
CREATE POLICY "Block all client access" ON mux_live_streams
    FOR ALL USING (false);