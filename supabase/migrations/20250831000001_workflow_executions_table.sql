-- Create workflow_executions table for tracking queue processing observability
-- This table tracks the execution lifecycle of workflow jobs including graceful shutdown handling

-- Create enum for execution status
CREATE TYPE workflow_execution_status AS ENUM (
  'pending',
  'processing', 
  'completed',
  'failed',
  'shutdown_interrupted',
  'cancelled'
);

-- Create enum for shutdown reasons
CREATE TYPE shutdown_reason AS ENUM (
  'timeout',
  'memory_limit',
  'manual_termination',
  'cold_start_timeout',
  'platform_maintenance',
  'unknown'
);

-- Create the workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core execution tracking
  message_id BIGINT NOT NULL, -- References pgmq message ID
  workflow_name TEXT NOT NULL,
  status workflow_execution_status DEFAULT 'pending' NOT NULL,
  
  -- Timing information
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  execution_time_ms BIGINT,
  
  -- Error and retry handling
  error_message TEXT,
  error_details JSONB DEFAULT '{}'::jsonb,
  retry_count INTEGER DEFAULT 0,
  
  -- Shutdown handling
  shutdown_detected_at TIMESTAMP WITH TIME ZONE,
  shutdown_reason shutdown_reason,
  shutdown_cleanup_completed BOOLEAN DEFAULT FALSE,
  
  -- Workflow data
  event_data JSONB DEFAULT '{}'::jsonb,
  result_data JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  function_instance_id TEXT, -- For tracking which edge function instance processed this
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_execution_time CHECK (execution_time_ms >= 0),
  CONSTRAINT valid_retry_count CHECK (retry_count >= 0),
  CONSTRAINT completed_requires_times CHECK (
    status != 'completed' OR (started_at IS NOT NULL AND completed_at IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX idx_workflow_executions_message_id ON workflow_executions(message_id);
CREATE INDEX idx_workflow_executions_workflow_name ON workflow_executions(workflow_name);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_created_at ON workflow_executions(created_at);
CREATE INDEX idx_workflow_executions_status_workflow ON workflow_executions(status, workflow_name);
CREATE INDEX idx_workflow_executions_heartbeat ON workflow_executions(last_heartbeat) 
  WHERE status = 'processing';

-- Enable RLS
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for service role" ON workflow_executions
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Enable insert access for service role" ON workflow_executions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update access for service role" ON workflow_executions
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete access for service role" ON workflow_executions
  FOR DELETE USING (auth.role() = 'service_role');

-- Grant permissions to API roles
GRANT USAGE ON TYPE workflow_execution_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE shutdown_reason TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_executions TO service_role;

-- Create helper function to update heartbeat
CREATE OR REPLACE FUNCTION update_execution_heartbeat(execution_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE workflow_executions 
  SET last_heartbeat = timezone('utc'::text, now())
  WHERE id = execution_id AND status = 'processing';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on helper function
GRANT EXECUTE ON FUNCTION update_execution_heartbeat TO service_role;

-- Create view for active executions monitoring
CREATE VIEW active_workflow_executions AS
SELECT 
  id,
  message_id,
  workflow_name,
  status,
  started_at,
  last_heartbeat,
  EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - started_at)) * 1000 AS running_time_ms,
  EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - last_heartbeat)) * 1000 AS time_since_heartbeat_ms,
  retry_count,
  shutdown_detected_at IS NOT NULL AS shutdown_detected,
  function_instance_id
FROM workflow_executions
WHERE status IN ('processing', 'shutdown_interrupted')
ORDER BY started_at DESC;

-- Grant access to the view
GRANT SELECT ON active_workflow_executions TO service_role;

-- Create view for execution statistics
CREATE VIEW workflow_execution_stats AS
SELECT 
  workflow_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
  COUNT(*) FILTER (WHERE status = 'shutdown_interrupted') as shutdown_interrupted_executions,
  AVG(execution_time_ms) FILTER (WHERE status = 'completed') as avg_execution_time_ms,
  MAX(execution_time_ms) FILTER (WHERE status = 'completed') as max_execution_time_ms,
  AVG(retry_count) as avg_retry_count,
  MAX(retry_count) as max_retry_count
FROM workflow_executions
GROUP BY workflow_name
ORDER BY total_executions DESC;

-- Grant access to the stats view
GRANT SELECT ON workflow_execution_stats TO service_role;

-- Add comment to document the table purpose
COMMENT ON TABLE workflow_executions IS 'Tracks the execution lifecycle of workflow jobs including graceful shutdown handling and observability metrics';