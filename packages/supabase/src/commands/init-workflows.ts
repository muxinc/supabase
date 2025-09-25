import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../../package.json';
import dotenv from 'dotenv';
import { checkIfSupabaseDirExists, createMigrationFiles } from './utils';

const muxSyncEngineVersion = packageJson.dependencies[
  '@mux/sync-engine'
].replace(/^\^/, '');
const supabaseDir = 'supabase';

const migrations = [
  {
    name: 'mux_enable_pgmq',
    content: `-- Enable the pgmq extension for message queues
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
notify pgrst, 'reload schema';`,
  },
  {
    name: 'mux_expose_pgmq_functions',
    content: `create or replace function pgmq_public.send(queue_name text, message jsonb)
returns bigint
language sql
security definer
as $$
select pgmq.send(queue_name => queue_name, msg => message);
$$;

create or replace function pgmq_public.read(queue_name text, sleep_seconds integer default 30, n integer default 1)
returns setof pgmq.message_record
language sql
security definer
as $$
select * from pgmq.read(queue_name => queue_name, vt => sleep_seconds, qty => n);
$$;

create or replace function pgmq_public.pop(queue_name text)
returns setof pgmq.message_record
language sql
security definer
as $$
select * from pgmq.pop(queue_name => queue_name);
$$;

create or replace function pgmq_public.delete(queue_name text, msg_id bigint)
returns boolean
language sql
security definer
as $$
select pgmq.delete(queue_name => queue_name, msg_id => msg_id);
$$;

create or replace function pgmq_public.archive(queue_name text, msg_id bigint)
returns boolean
language sql
security definer
as $$
select pgmq.archive(queue_name => queue_name, msg_id => msg_id);
$$;`,
  },
  {
    name: 'mux_setup_cron_job',
    content: `-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job
SELECT cron.schedule(
'process-queue-cron',
'10 seconds', -- Every 10s
$$
SELECT net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/process-queue-cron',
  headers:=jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer: ' || (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
  ),
  body := jsonb_build_object('triggered_by', 'cron')
);
select * from net._http_response;
$$
);`,
  },
];

async function shouldOverwriteProcessQueueCron(
  processQueueCronDir: string
): Promise<boolean> {
  if (!fs.existsSync(processQueueCronDir)) {
    return true;
  }

  console.log(
    chalk.yellow('\n⚠️  Warning: process-queue-cron function already exists!')
  );

  const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
    {
      type: 'confirm',
      name: 'overwrite',
      message:
        'Do you want to overwrite the existing process-queue-cron function?',
      default: false,
    },
  ]);

  if (!overwrite) {
    console.log(chalk.blue('Files will not be modified.'));
    return false;
  }

  console.log(chalk.yellow('Proceeding with overwrite...'));
  return true;
}

function createProcessQueueCronFunction(processQueueCronDir: string): void {
  // Create directories
  fs.mkdirSync(processQueueCronDir, { recursive: true });

  const functionCode = `import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { processQueueCron } from '@mux/supabase';

Deno.serve(async (req) => {
  await processQueueCron(req);
  return new Response(JSON.stringify({ message: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
`;

  fs.writeFileSync(path.join(processQueueCronDir, 'index.ts'), functionCode);

  // Create deno.json for imports
  const denoConfig = {
    imports: {
      '@mux/sync-engine': `npm:@mux/sync-engine@${muxSyncEngineVersion}`,
    },
  };

  fs.writeFileSync(
    path.join(processQueueCronDir, 'deno.json'),
    JSON.stringify(denoConfig, null, 2)
  );

  console.log(
    chalk.green(
      '✅ Created Supabase Edge Function at supabase/functions/process-queue-cron/'
    )
  );
}

async function setupProcessQueueCron(): Promise<void> {
  const processQueueCronDir = path.join(
    supabaseDir,
    'functions',
    'process-queue-cron'
  );

  const shouldCreate =
    await shouldOverwriteProcessQueueCron(processQueueCronDir);

  if (shouldCreate) {
    createProcessQueueCronFunction(processQueueCronDir);
  }
}

function displayNextSteps(): void {
  console.log(chalk.blue.bold('\n🎉 AI Workflows setup completed!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(
    '1. Run migrations on production: ' + chalk.cyan('supabase migration up')
  );
  console.log(
    '2. Deploy the Edge Function: ' +
      chalk.cyan('supabase functions deploy process-queue-cron')
  );
  console.log(
    '3. Verify migrations applied (pgmq + cron): queue "workflow_messages" and cron job exist.'
  );
}

async function setupDatabase(): Promise<void> {
  const functionsEnvPath = path.join(
    process.cwd(),
    'supabase',
    'functions',
    '.env'
  );
  if (fs.existsSync(functionsEnvPath)) {
    dotenv.config({ path: functionsEnvPath });
  }

  const databaseUrl = process.env.SUPABASE_DB_URL;

  if (!databaseUrl) {
    console.log(
      chalk.yellow('No database URL found in environment variables.')
    );
    console.log(chalk.blue('Please set SUPABASE_DB_URL environment variable.'));
    console.log(
      chalk.gray(
        'Example: export SUPABASE_DB_URL="postgresql://your-database-url"'
      )
    );
    process.exit(1);
  }

  await createMigrationFiles(migrations);
}

export async function initWorkflowsCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 Mux AI Workflows on Supabase'));
  console.log(
    chalk.gray(
      'This will set up Supabase queues, a new Edge Function, and create migration files.\n'
    )
  );

  checkIfSupabaseDirExists();

  await setupProcessQueueCron();

  try {
    await setupDatabase();
    displayNextSteps();
  } catch (error) {
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}
