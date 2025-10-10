import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../../package.json';
import {
  checkIfSupabaseDirExists,
  getMigrationFilesFromSyncEngine,
  createMigrationFiles,
  createFunctionsEnvFile,
  shouldOverwriteFunction,
  runSupabaseMigrations,
} from './utils';
import { ensureTomlProperty, ensureTomlArrayItem } from './toml-modifications';

const muxSyncEngineVersion = packageJson.dependencies[
  '@mux/sync-engine'
].replace(/^\^/, '');
const muxSupabaseVersion = packageJson.version;
const supabaseDir = 'supabase';

function createMuxWebhookFunction(muxWebhookDir: string): void {
  // Create directories
  fs.mkdirSync(muxWebhookDir, { recursive: true });

  // Create supabase/functions/.env if it doesn't exist
  createFunctionsEnvFile();

  const functionCode = `import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { MuxSync } from 'npm:@mux/sync-engine@${muxSyncEngineVersion}'
import { queueWorkflowsForEvent } from 'npm:@mux/supabase@${muxSupabaseVersion}'

// Load secrets from environment variables
const databaseUrl = Deno.env.get('SUPABASE_DB_URL') || 'postgresql://your-database-url'
const muxWebhookSecret = Deno.env.get('MUX_WEBHOOK_SECRET') || 'your-mux-webhook-secret'
const muxTokenId = Deno.env.get('MUX_TOKEN_ID') || 'your-mux-token-id'
const muxTokenSecret = Deno.env.get('MUX_TOKEN_SECRET') || 'your-mux-token-secret'

// Initialize MuxSync
const muxSync = new MuxSync({
  databaseUrl,
  muxWebhookSecret,
  muxTokenId,
  muxTokenSecret,
  backfillRelatedEntities: false,
  revalidateEntityViaMuxApi: true,
  maxPostgresConnections: 5,
  logger: console
})

// Create HTTP server handler
Deno.serve(async (req) => {
  // Only handle POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const body = await req.text()
    await muxSync.processWebhook(body, Object.fromEntries(req.headers.entries()))
    await queueWorkflowsForEvent(body, Object.fromEntries(req.headers.entries()))

    return new Response(
      JSON.stringify({ status: 'success' }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
`;

  fs.writeFileSync(path.join(muxWebhookDir, 'index.ts'), functionCode);

  // Create deno.json for imports
  const denoConfig = {
    imports: {
      '@mux/sync-engine': `npm:@mux/sync-engine@${muxSyncEngineVersion}`,
    },
  };

  fs.writeFileSync(
    path.join(muxWebhookDir, 'deno.json'),
    JSON.stringify(denoConfig, null, 2)
  );

  console.log(
    chalk.green(
      '✅ Created Supabase Edge Function at supabase/functions/mux-webhook/'
    )
  );
}

function updateSupabaseConfig(): void {
  const configPath = path.join(supabaseDir, 'config.toml');

  if (!fs.existsSync(configPath)) {
    console.log(
      chalk.yellow('⚠️  config.toml not found in supabase directory')
    );
    return;
  }

  // Add 'mux' to [api].schemas array
  const schemasResult = ensureTomlArrayItem(
    configPath,
    'api',
    'schemas',
    'mux'
  );
  if (schemasResult.modified) {
    console.log(chalk.green('✅ Added "mux" to [api].schemas in config.toml'));
  } else if (schemasResult.message.includes('already exists')) {
    console.log(chalk.gray('config.toml already has "mux" in [api].schemas'));
  }

  // Add verify_jwt = false to [functions.mux-webhook]
  const result = ensureTomlProperty(
    configPath,
    'functions.mux-webhook',
    'verify_jwt',
    false
  );

  if (result.modified) {
    console.log(
      chalk.green(
        '✅ Added verify_jwt = false to [functions.mux-webhook] in config.toml'
      )
    );
  } else {
    console.log(
      chalk.gray(
        'config.toml already has verify_jwt = false for mux-webhook function'
      )
    );
  }
}

async function setupMuxWebhook(): Promise<void> {
  const muxWebhookDir = path.join(supabaseDir, 'functions', 'mux-webhook');

  const shouldCreate = await shouldOverwriteFunction(
    muxWebhookDir,
    'mux-webhook'
  );

  if (shouldCreate) {
    createMuxWebhookFunction(muxWebhookDir);
    updateSupabaseConfig();
  }
}

function displayNextSteps(): void {
  console.log(chalk.blue.bold('\n🎉 Setup completed successfully!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Set the required environment variables:');
  console.log('   - MUX_TOKEN_ID: Your Mux token ID');
  console.log('   - MUX_TOKEN_SECRET: Your Mux token secret');
  console.log(
    '2. Run the Edge Function locally: ' +
      chalk.cyan('supabase functions serve mux-webhook')
  );
  console.log(
    '3. Configure your Mux webhook to point to your Supabase function URL'
  );
  console.log(
    '4. Set the MUX_WEBHOOK_SECRET variable: A secret key for webhook verification'
  );
  console.log('5. Test the webhook with a Mux event');
  console.log(
    chalk.gray(
      '💡 Tip: For production development, you can set secrets in Supabase Dashboard > Settings > Edge Functions > Secrets'
    )
  );
  console.log(
    chalk.gray(
      '   Or via CLI: supabase secrets set MUX_TOKEN_ID="your-id" MUX_TOKEN_SECRET="your-secret" MUX_WEBHOOK_SECRET="your-webhook-secret"'
    )
  );
}

async function setupDatabase(): Promise<void> {
  console.log(
    chalk.blue('📦 Getting migration files from @mux/sync-engine...')
  );
  const migrations = getMigrationFilesFromSyncEngine();

  if (migrations.length === 0) {
    console.log(chalk.yellow('No migration files found in @mux/sync-engine'));
    return;
  }

  console.log(chalk.blue(`Found ${migrations.length} migration files`));
  await createMigrationFiles(migrations);

  console.log(chalk.green('✅ Migration files created!'));

  await runSupabaseMigrations();
}

export async function initCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 Mux Sync Engine - Supabase Initialization'));
  console.log(
    chalk.gray(
      'This will run migrations in your Supabase database and create a Supabase Edge Function example.\n'
    )
  );

  checkIfSupabaseDirExists();

  await setupMuxWebhook();

  try {
    await setupDatabase();
    displayNextSteps();
  } catch (error) {
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}
