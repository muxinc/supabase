-- Row Level Security (RLS) policies
-- Enforces access control at the database level
-- Server-side only access: blocks all client (anon/authenticated) access

-- Grant usage on the mux schema to service_role only
-- Note: anon and authenticated roles can still see the schema exists but cannot query tables
GRANT USAGE ON SCHEMA mux TO anon, authenticated, service_role;

-- Grant full permissions to service_role for server-side operations
GRANT ALL ON ALL TABLES IN SCHEMA mux TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mux GRANT ALL ON TABLES TO service_role;

-- Enable RLS on all Mux tables (required for exposed schemas)
ALTER TABLE "mux"."assets"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mux"."live_streams"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mux"."uploads"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mux"."webhook_events"  ENABLE ROW LEVEL SECURITY;

-- Block all client access - only service_role can bypass RLS
-- These policies ensure anon and authenticated roles cannot access data
DROP POLICY IF EXISTS "Block client access" ON "mux"."assets";
CREATE POLICY "Block client access" ON "mux"."assets"
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Block client access" ON "mux"."live_streams";
CREATE POLICY "Block client access" ON "mux"."live_streams"
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Block client access" ON "mux"."uploads";
CREATE POLICY "Block client access" ON "mux"."uploads"
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Block client access" ON "mux"."webhook_events";
CREATE POLICY "Block client access" ON "mux"."webhook_events"
  FOR ALL USING (false);