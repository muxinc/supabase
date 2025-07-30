-- Create mux_workflow_outputs table
CREATE TABLE mux_workflow_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output JSONB,
    mux_asset_id TEXT,
    slug TEXT,
    version TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    runtime_ms BIGINT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_mux_workflow_outputs_mux_asset_id ON mux_workflow_outputs(mux_asset_id);
CREATE INDEX idx_mux_workflow_outputs_status ON mux_workflow_outputs(status);
CREATE INDEX idx_mux_workflow_outputs_created_at ON mux_workflow_outputs(created_at);
CREATE INDEX idx_mux_workflow_outputs_updated_at ON mux_workflow_outputs(updated_at);
CREATE INDEX idx_mux_workflow_outputs_slug ON mux_workflow_outputs(slug);

-- Create updated_at trigger
CREATE TRIGGER update_mux_workflow_outputs_updated_at
    BEFORE UPDATE ON mux_workflow_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE mux_workflow_outputs ENABLE ROW LEVEL SECURITY;

-- Create policy that denies all client access
CREATE POLICY "Block all client access" ON mux_workflow_outputs
    FOR ALL USING (false);