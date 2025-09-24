import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../../package.json';
import {
  checkIfSupabaseDirExists,
  createMigrationFiles,
  createFunctionsEnvFile,
  shouldOverwriteFunction,
  runSupabaseMigrations,
  setupDatabaseWithEnvLoading,
} from './utils';

const muxSyncEngineVersion = packageJson.dependencies[
  '@mux/sync-engine'
].replace(/^\^/, '');
const muxSupabaseVersion = packageJson.version;
const supabaseDir = 'supabase';

function getWorkflowMigrations(): { name: string; content: string }[] {
  return [
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
}

function createProcessQueueCronFunction(processQueueCronDir: string): void {
  // Create directories
  fs.mkdirSync(processQueueCronDir, { recursive: true });

  // Create supabase/functions/.env if it doesn't exist
  createFunctionsEnvFile();

  const functionCode = `import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { processQueueCron } from 'npm:@mux/supabase@${muxSupabaseVersion}'

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
      '@mux/supabase': `npm:@mux/supabase@${muxSupabaseVersion}`,
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

function updateSupabaseConfigForVault(): void {
  const configPath = path.join(supabaseDir, 'config.toml');

  if (!fs.existsSync(configPath)) {
    console.log(
      chalk.yellow('⚠️  config.toml not found in supabase directory')
    );
    return;
  }

  let configContent = fs.readFileSync(configPath, 'utf-8');

  // Check if [db.vault] section already exists
  const vaultSectionRegex = /^\[db\.vault\]\s*$/m;
  const secretKeyRegex = /^\s*secret_key\s*=\s*"env\(SUPABASE_SERVICE_ROLE_KEY\)"\s*$/m;
  const supabaseUrlRegex = /^\s*supabase_url\s*=\s*"env\(SUPABASE_URL\)"\s*$/m;

  const hasVaultSection = vaultSectionRegex.test(configContent);
  let hasSecretKey = false;
  let hasSupabaseUrl = false;

  if (hasVaultSection) {
    // Check if the required keys exist in the vault section
    const lines = configContent.split('\n');
    let inVaultSection = false;

    for (const line of lines) {
      if (line.match(vaultSectionRegex)) {
        inVaultSection = true;
        continue;
      }

      if (inVaultSection) {
        // If we hit another section, we're done with vault section
        if (line.match(/^\[.*\]$/)) {
          break;
        }

        if (line.match(secretKeyRegex)) {
          hasSecretKey = true;
        }
        if (line.match(supabaseUrlRegex)) {
          hasSupabaseUrl = true;
        }
      }
    }
  }

  // If everything is already configured, skip
  if (hasVaultSection && hasSecretKey && hasSupabaseUrl) {
    console.log(
      chalk.gray(
        'config.toml already has [db.vault] section with required secrets'
      )
    );
    return;
  }

  // Build the configuration to add
  let configToAdd = '';

  if (!hasVaultSection) {
    // Add the entire section
    configToAdd = '\n[db.vault]\nsecret_key = "env(SUPABASE_SERVICE_ROLE_KEY)"\nsupabase_url = "env(SUPABASE_URL)"\n';
    configContent += configToAdd;
  } else {
    // Add missing keys to existing section
    const lines = configContent.split('\n');
    const newLines = [];
    let inVaultSection = false;
    let addedKeys = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      newLines.push(line);

      if (line.match(vaultSectionRegex)) {
        inVaultSection = true;
        continue;
      }

      if (inVaultSection && !addedKeys) {
        // If we hit another section or end of file, add missing keys before it
        if (line.match(/^\[.*\]$/) || i === lines.length - 1) {
          const keysToAdd = [];
          if (!hasSecretKey) {
            keysToAdd.push('secret_key = "env(SUPABASE_SERVICE_ROLE_KEY)"');
          }
          if (!hasSupabaseUrl) {
            keysToAdd.push('supabase_url = "env(SUPABASE_URL)"');
          }

          if (keysToAdd.length > 0) {
            if (line.match(/^\[.*\]$/)) {
              // Insert before the new section
              newLines.splice(-1, 0, ...keysToAdd);
            } else {
              // Add at the end
              newLines.push(...keysToAdd);
            }
          }
          addedKeys = true;
          inVaultSection = false;
        }
      }
    }

    configContent = newLines.join('\n');
  }

  fs.writeFileSync(configPath, configContent);

  const addedItems = [];
  if (!hasVaultSection || !hasSecretKey) {
    addedItems.push('secret_key');
  }
  if (!hasVaultSection || !hasSupabaseUrl) {
    addedItems.push('supabase_url');
  }

  console.log(
    chalk.green(
      `✅ Added ${addedItems.join(' and ')} to [db.vault] in config.toml`
    )
  );
}

async function setupProcessQueueCron(): Promise<void> {
  const processQueueCronDir = path.join(
    supabaseDir,
    'functions',
    'process-queue-cron'
  );

  const shouldCreate = await shouldOverwriteFunction(processQueueCronDir, 'process-queue-cron');

  if (shouldCreate) {
    createProcessQueueCronFunction(processQueueCronDir);
    updateSupabaseConfigForVault();
  }
}

function displayNextSteps(): void {
  console.log(chalk.blue.bold('\n🎉 AI Workflows setup completed successfully!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Set the required environment variables:');
  console.log('   - SUPABASE_URL: Your Supabase project URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key');
  console.log(
    '2. Deploy the Edge Function: ' + chalk.cyan('supabase functions deploy process-queue-cron')
  );
  console.log('3. Verify the setup:');
  console.log('   - Check that pgmq extension is enabled');
  console.log('   - Verify "workflow_messages" queue exists');
  console.log('   - Confirm cron job is scheduled and running');
  console.log(
    chalk.gray(
      '\n💡 Tip: The vault secrets are configured to read from environment variables'
    )
  );
  console.log(
    chalk.gray(
      '   Make sure to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment'
    )
  );
  console.log(
    chalk.gray(
      '   For local development, you can add them to your .env file'
    )
  );
}

async function setupDatabase(): Promise<void> {
  await setupDatabaseWithEnvLoading();

  console.log(
    chalk.blue('📦 Getting workflow migration files...')
  );
  const migrations = getWorkflowMigrations();

  console.log(chalk.blue(`Found ${migrations.length} workflow migration files`));
  await createMigrationFiles(migrations);

  console.log(chalk.green('✅ Migration files created!'));

  await runSupabaseMigrations();
}

export async function initWorkflowsCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 Mux AI Workflows - Supabase Initialization'));
  console.log(
    chalk.gray(
      'This will run workflow migrations in your Supabase database and create a process-queue-cron Edge Function.\n'
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
