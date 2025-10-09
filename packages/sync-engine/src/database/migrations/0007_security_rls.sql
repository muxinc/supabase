-- Row Level Security (RLS) policies
-- Enforces access control at the database level

-- Enable RLS on all Mux tables
ALTER TABLE "mux"."assets"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mux"."live_streams"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mux"."uploads"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mux"."webhook_events"  ENABLE ROW LEVEL SECURITY;

-- Block all direct client access (data should only be accessed through API)
DROP POLICY IF EXISTS "Block all client access" ON "mux"."assets";
CREATE POLICY "Block all client access" ON "mux"."assets"
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Block all client access" ON "mux"."live_streams";
CREATE POLICY "Block all client access" ON "mux"."live_streams"
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Block all client access" ON "mux"."uploads";
CREATE POLICY "Block all client access" ON "mux"."uploads"
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Block all client access" ON "mux"."webhook_events";
CREATE POLICY "Block all client access" ON "mux"."webhook_events"
  FOR ALL USING (false);