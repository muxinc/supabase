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
} from './utils';
import { ensureTomlProperties, ensureTomlProperty, ensureTomlArrayItem } from './toml-modifications';

const muxSyncEngineVersion = packageJson.dependencies[
  '@mux/sync-engine'
].replace(/^\^/, '');
const muxSupabaseVersion = packageJson.version;
const supabaseDir = 'supabase';

function getWorkflowMigrationsPath(): string {
  try {
    // When running from built package, migrations are in dist/migrations
    const packageJsonPath = require.resolve('@mux/supabase/package.json');
    const packageDir = path.dirname(packageJsonPath);
    const migrationsPath = path.join(packageDir, 'dist', 'migrations');

    if (fs.existsSync(migrationsPath)) {
      return migrationsPath;
    }

    // When running from source during development
    const srcMigrationsPath = path.join(packageDir, 'src', 'migrations');
    if (fs.existsSync(srcMigrationsPath)) {
      return srcMigrationsPath;
    }

    throw new Error(
      `Migrations directory not found at: ${migrationsPath} or ${srcMigrationsPath}`
    );
  } catch (error) {
    // Fallback for local development when running directly from source
    const localMigrationsPath = path.join(__dirname, '..', 'migrations');
    if (fs.existsSync(localMigrationsPath)) {
      return localMigrationsPath;
    }

    throw new Error(
      `Failed to locate migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function getWorkflowMigrations(): { name: string; content: string }[] {
  const migrationsPath = getWorkflowMigrationsPath();

  if (!fs.existsSync(migrationsPath)) {
    console.log(
      chalk.yellow(`Migrations directory not found: ${migrationsPath}`)
    );
    return [];
  }

  const migrationFiles = fs
    .readdirSync(migrationsPath)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const migrations: { name: string; content: string }[] = [];

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsPath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    // Remove the timestamp and .sql extension to get a clean name
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
    migrations.push({ name, content });
  }

  return migrations;
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

  const result = ensureTomlProperties(configPath, 'db.vault', {
    mux_supabase_service_role_key: 'env(SUPABASE_SERVICE_ROLE_KEY)',
    mux_supabase_url: 'env(SUPABASE_URL)',
  });

  if (result.modified) {
    console.log(chalk.green(`✅ ${result.message}`));
  } else {
    console.log(
      chalk.gray(
        'config.toml already has [db.vault] section with required secrets'
      )
    );
  }
}

function updateSupabaseConfigForSchemas(): void {
  const configPath = path.join(supabaseDir, 'config.toml');

  if (!fs.existsSync(configPath)) {
    console.log(
      chalk.yellow('⚠️  config.toml not found in supabase directory')
    );
    return;
  }

  const schemasResult = ensureTomlArrayItem(
    configPath,
    'api',
    'schemas',
    'pgmq_public'
  );

  if (schemasResult.modified) {
    console.log(chalk.green('✅ Added "pgmq_public" to [api].schemas in config.toml'));
  } else if (schemasResult.message.includes('already exists')) {
    console.log(chalk.gray('config.toml already has "pgmq_public" in [api].schemas'));
  }
}

function updateSupabaseConfigForMuxWebhook(): void {
  const configPath = path.join(supabaseDir, 'config.toml');

  if (!fs.existsSync(configPath)) {
    console.log(
      chalk.yellow('⚠️  config.toml not found in supabase directory')
    );
    return;
  }

  // Check if the mux-webhook section exists first
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const sectionRegex = /^\[functions\.mux-webhook\]\s*$/m;

  if (!sectionRegex.test(configContent)) {
    console.log(
      chalk.gray(
        '[functions.mux-webhook] section not found in config.toml, skipping static_files configuration'
      )
    );
    return;
  }

  const result = ensureTomlProperty(
    configPath,
    'functions.mux-webhook',
    'static_files',
    ['./functions/mux-webhook/mux.toml']
  );

  if (result.modified) {
    console.log(
      chalk.green(
        '✅ Added static_files to [functions.mux-webhook] in config.toml'
      )
    );
  } else {
    console.log(
      chalk.gray(
        '[functions.mux-webhook] already has static_files configuration'
      )
    );
  }
}

function createMuxTomlFile(): void {
  const muxWebhookDir = path.join(supabaseDir, 'functions', 'mux-webhook');

  // Check if the mux-webhook directory exists
  if (!fs.existsSync(muxWebhookDir)) {
    console.log(
      chalk.gray('mux-webhook directory not found, skipping mux.toml creation')
    );
    return;
  }

  const muxTomlPath = path.join(muxWebhookDir, 'mux.toml');

  // Check if mux.toml already exists
  if (fs.existsSync(muxTomlPath)) {
    console.log(chalk.gray('mux.toml already exists in mux-webhook directory'));
    return;
  }

  // Create mux.toml with the template content
  const muxTomlContent = `# [workflows.content-moderation]
# events = ["video.asset.ready"]
`;

  fs.writeFileSync(muxTomlPath, muxTomlContent);

  console.log(
    chalk.green('✅ Created mux.toml in supabase/functions/mux-webhook/')
  );
}

async function setupProcessQueueCron(): Promise<void> {
  const processQueueCronDir = path.join(
    supabaseDir,
    'functions',
    'process-queue-cron'
  );

  const shouldCreate = await shouldOverwriteFunction(
    processQueueCronDir,
    'process-queue-cron'
  );

  if (shouldCreate) {
    createProcessQueueCronFunction(processQueueCronDir);
    updateSupabaseConfigForVault();
  }
}

function displayNextSteps(): void {
  console.log(
    chalk.blue.bold('\n🎉 AI Workflows setup completed successfully!')
  );
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Set the required environment variables:');
  console.log('   - SUPABASE_URL: Your Supabase project URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key');
  console.log(
    '2. Run the Edge Function locally: ' +
      chalk.cyan('supabase functions serve process-queue-cron')
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
      '\n💡 Tip: For production development, you can set secrets in Supabase Dashboard > Settings > Edge Functions > Secrets'
    )
  );
  console.log(
    chalk.gray(
      '   Or via CLI: supabase secrets set SUPABASE_URL="your-supabase-url" SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_key"'
    )
  );
}

async function setupDatabase(): Promise<void> {
  console.log(chalk.blue('📦 Getting workflow migration files...'));
  const migrations = getWorkflowMigrations();

  console.log(
    chalk.blue(`Found ${migrations.length} workflow migration files`)
  );
  await createMigrationFiles(migrations);

  console.log(chalk.green('✅ Migration files created!'));

  await runSupabaseMigrations();
}

export async function initWorkflowsCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 Mux AI Workflows - Supabase Initialization'));
  console.log(
    chalk.gray(
      'This will set up Supabase queues, a new Edge Function, and create migration files.\n'
    )
  );

  checkIfSupabaseDirExists();

  await setupProcessQueueCron();

  // Update config.toml for schemas
  updateSupabaseConfigForSchemas();

  // Update config.toml for mux-webhook function
  updateSupabaseConfigForMuxWebhook();

  // Create mux.toml in mux-webhook directory
  createMuxTomlFile();

  try {
    await setupDatabase();
    displayNextSteps();
  } catch (error) {
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}
