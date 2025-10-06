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

  let configContent = fs.readFileSync(configPath, 'utf-8');

  // Check if [db.vault] section already exists
  const vaultSectionRegex = /^\[db\.vault\]\s*$/m;
  const serviceRoleKeyRegex =
    /^\s*mux_supabase_service_role_key\s*=\s*"env\(SUPABASE_SERVICE_ROLE_KEY\)"\s*$/m;
  const supabaseUrlRegex =
    /^\s*mux_supabase_url\s*=\s*"env\(SUPABASE_URL\)"\s*$/m;

  const hasVaultSection = vaultSectionRegex.test(configContent);
  let hasServiceRoleKey = false;
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

        if (line.match(serviceRoleKeyRegex)) {
          hasServiceRoleKey = true;
        }
        if (line.match(supabaseUrlRegex)) {
          hasSupabaseUrl = true;
        }
      }
    }
  }

  // If everything is already configured, skip
  if (hasVaultSection && hasServiceRoleKey && hasSupabaseUrl) {
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
    configToAdd =
      '\n[db.vault]\nmux_supabase_service_role_key = "env(SUPABASE_SERVICE_ROLE_KEY)"\nmux_supabase_url = "env(SUPABASE_URL)"\n';
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
          if (!hasServiceRoleKey) {
            keysToAdd.push(
              'mux_supabase_service_role_key = "env(SUPABASE_SERVICE_ROLE_KEY)"'
            );
          }
          if (!hasSupabaseUrl) {
            keysToAdd.push('mux_supabase_url = "env(SUPABASE_URL)"');
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
  if (!hasVaultSection || !hasServiceRoleKey) {
    addedItems.push('mux_supabase_service_role_key');
  }
  if (!hasVaultSection || !hasSupabaseUrl) {
    addedItems.push('mux_supabase_url');
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
    '2. Deploy the Edge Function: ' +
      chalk.cyan('supabase functions deploy process-queue-cron')
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
    chalk.gray('   For local development, you can add them to your .env file')
  );
}

async function setupDatabase(): Promise<void> {
  await setupDatabaseWithEnvLoading();

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

  try {
    await setupDatabase();
    displayNextSteps();
  } catch (error) {
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}
