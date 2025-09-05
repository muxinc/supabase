-- Fix RLS policies to allow anon and authenticated users to read data
-- This migration updates the permissions for the workflow_executions table and views

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable read access for service role" ON workflow_executions;

-- Create new policies that allow read access for all authenticated and anon users
CREATE POLICY "Enable read access for all users" ON workflow_executions
  FOR SELECT USING (true);

-- Keep write operations restricted to service role
-- (Insert, Update, Delete policies remain unchanged)

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON workflow_executions TO anon, authenticated;

-- Grant SELECT permissions on views to anon and authenticated roles
GRANT SELECT ON active_workflow_executions TO anon, authenticated;
GRANT SELECT ON workflow_execution_stats TO anon, authenticated;

-- Add comment explaining the change
COMMENT ON POLICY "Enable read access for all users" ON workflow_executions IS 'Allows all users (anon, authenticated, service_role) to read workflow execution data for dashboard visibility';