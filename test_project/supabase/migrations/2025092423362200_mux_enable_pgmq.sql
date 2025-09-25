-- Enable the pgmq extension for message queues
CREATE EXTENSION IF NOT EXISTS pgmq;

SELECT pgmq.create('workflow_messages');

ALTER TABLE pgmq.q_workflow_messages ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA if not exists pgmq_public;
-- 4) Grants for API roles
grant usage on schema pgmq_public to anon, authenticated, service_role;
grant execute on all functions in schema pgmq_public to anon, authenticated, service_role;
-- GRANT USAGE ON SCHEMA pgmq_public TO anon, authenticated, service_role;
-- GRANT ALL ON ALL TABLES IN SCHEMA pgmq_public TO anon, authenticated, service_role;
-- GRANT ALL ON ALL ROUTINES IN SCHEMA pgmq_public TO anon, authenticated, service_role;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA pgmq_public TO anon, authenticated, service_role;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgmq_public GRANT ALL ON TABLES TO anon, authenticated, service_role;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgmq_public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgmq_public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

alter role authenticator
set pgrst.db_schemas = 'public,graphql_public,pgmq_public';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';