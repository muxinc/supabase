-- Enable realtime for workflow_executions table
-- This allows the Next.js dashboard to receive live updates

-- Add the workflow_executions table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_executions;

-- Note: The views (workflow_execution_stats, active_workflow_executions) 
-- are not added to realtime as they're computed views that don't need
-- real-time updates - the base table changes will trigger UI refreshes