import { Client } from 'pg';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../../package.json';
import { checkIfSupabaseDirExists, createMigrationFiles } from './utils';

const muxSyncEngineVersion = packageJson.dependencies[
  '@mux/sync-engine'
].replace(/^\^/, '');
const muxSupabaseVersion = packageJson.version;
const supabaseDir = 'supabase';

interface InitAnswers {
  databaseUrl: string;
}

const migrations = [
  {
    name: 'create_mux_assets_table',
    content: `-- Ensure schema and target it
    CREATE SCHEMA IF NOT EXISTS mux;
    SET search_path TO mux, public;

    -- Create mux_assets table
    CREATE TABLE mux_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mux_asset_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    duration DECIMAL,
    max_stored_resolution TEXT,
    max_stored_frame_rate DECIMAL,
    aspect_ratio TEXT,
    playback_ids JSONB DEFAULT '[]'::jsonb,
    tracks JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    master_access TEXT,
    mp4_support TEXT,
    normalize_audio BOOLEAN DEFAULT false,
    static_renditions JSONB DEFAULT '{}'::jsonb,
    test BOOLEAN DEFAULT false,
    passthrough TEXT,
    live_stream_id TEXT,
    encoding_tier TEXT,
    ingest_type TEXT,
    source_asset_id TEXT,
    per_title_encode BOOLEAN DEFAULT false,
    upload_id TEXT,
    input_info JSONB DEFAULT '{}'::jsonb,
    video_quality TEXT,
    resolution_tier TEXT,
    non_standard_input_reasons JSONB DEFAULT '[]'::jsonb,
    is_live BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX idx_mux_assets_mux_asset_id ON mux_assets(mux_asset_id);
    CREATE INDEX idx_mux_assets_status ON mux_assets(status);
    CREATE INDEX idx_mux_assets_created_at ON mux_assets(created_at);
    CREATE INDEX idx_mux_assets_updated_at ON mux_assets(updated_at);
    CREATE INDEX idx_mux_assets_live_stream_id ON mux_assets(live_stream_id);

    -- Create updated_at trigger
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = timezone('utc'::text, now());
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_mux_assets_updated_at
        BEFORE UPDATE ON mux_assets
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    -- Enable RLS
    ALTER TABLE mux_assets ENABLE ROW LEVEL SECURITY;

    -- Create policy that denies all client access
    CREATE POLICY "Block all client access" ON mux_assets
    FOR ALL USING (false);`,
  },
  {
    name: 'create_mux_live_streams_table',
    content: `-- Ensure schema and target it
    CREATE SCHEMA IF NOT EXISTS mux;
    SET search_path TO mux, public;
    
    -- Create mux_live_streams table
    CREATE TABLE mux_live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mux_live_stream_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    stream_key TEXT,
    active_asset_id TEXT,
    recent_asset_ids JSONB DEFAULT '[]'::jsonb,
    playback_ids JSONB DEFAULT '[]'::jsonb,
    new_asset_settings JSONB DEFAULT '{}'::jsonb,
    passthrough TEXT,
    audio_only BOOLEAN DEFAULT false,
    embedded_subtitles JSONB DEFAULT '[]'::jsonb,
    generated_subtitles JSONB DEFAULT '[]'::jsonb,
    latency_mode TEXT,
    test BOOLEAN DEFAULT false,
    max_continuous_duration INTEGER,
    reconnect_window DECIMAL,
    use_slate_for_standard_latency BOOLEAN DEFAULT false,
    reconnect_slate_url TEXT,
    reduced_latency BOOLEAN DEFAULT false,
    low_latency BOOLEAN DEFAULT false,
    simulcast_targets JSONB DEFAULT '[]'::jsonb,
    target_latency DECIMAL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX idx_mux_live_streams_mux_live_stream_id ON mux_live_streams(mux_live_stream_id);
    CREATE INDEX idx_mux_live_streams_status ON mux_live_streams(status);
    CREATE INDEX idx_mux_live_streams_created_at ON mux_live_streams(created_at);
    CREATE INDEX idx_mux_live_streams_updated_at ON mux_live_streams(updated_at);
    CREATE INDEX idx_mux_live_streams_active_asset_id ON mux_live_streams(active_asset_id);

    -- Create updated_at trigger
    CREATE TRIGGER update_mux_live_streams_updated_at
        BEFORE UPDATE ON mux_live_streams
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    -- Enable RLS
    ALTER TABLE mux_live_streams ENABLE ROW LEVEL SECURITY;

    -- Create policy that denies all client access
    CREATE POLICY "Block all client access" ON mux_live_streams
    FOR ALL USING (false);`,
  },
  {
    name: 'create_mux_workflow_outputs_table',
    content: `-- Ensure schema and target it
    CREATE SCHEMA IF NOT EXISTS mux;
    SET search_path TO mux, public;
    
    -- Create mux_workflow_outputs table
    CREATE TABLE mux_workflow_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output JSONB,
    mux_asset_id TEXT,
    slug TEXT,
    version TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    runtime_ms BIGINT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX idx_mux_workflow_outputs_mux_asset_id ON mux_workflow_outputs(mux_asset_id);
    CREATE INDEX idx_mux_workflow_outputs_status ON mux_workflow_outputs(status);
    CREATE INDEX idx_mux_workflow_outputs_created_at ON mux_workflow_outputs(created_at);
    CREATE INDEX idx_mux_workflow_outputs_updated_at ON mux_workflow_outputs(updated_at);
    CREATE INDEX idx_mux_workflow_outputs_slug ON mux_workflow_outputs(slug);

    -- Create updated_at trigger
    CREATE TRIGGER update_mux_workflow_outputs_updated_at
        BEFORE UPDATE ON mux_workflow_outputs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    -- Enable RLS
    ALTER TABLE mux_workflow_outputs ENABLE ROW LEVEL SECURITY;

    -- Create policy that denies all client access
    CREATE POLICY "Block all client access" ON mux_workflow_outputs
    FOR ALL USING (false);`,
  },
];

async function shouldOverwriteMuxWebhook(
  muxWebhookDir: string
): Promise<boolean> {
  if (!fs.existsSync(muxWebhookDir)) {
    return true;
  }

  console.log(
    chalk.yellow('\n⚠️  Warning: mux-webhook function already exists!')
  );

  const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
    {
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to overwrite the existing mux-webhook function?',
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

function createFunctionsEnvFile(): void {
  const functionsEnvPath = path.join(supabaseDir, 'functions', '.env');
  if (!fs.existsSync(functionsEnvPath)) {
    const envContent = `# Used to develop Edge Functions locally.\n# Configure the secrets required by the mux-webhook function.\nMUX_TOKEN_ID=your-mux-token-id\nMUX_TOKEN_SECRET=your-mux-token-secret\nMUX_WEBHOOK_SECRET=your-mux-webhook-secret\n`;
    fs.writeFileSync(functionsEnvPath, envContent);
    console.log(chalk.green('✅ Created supabase/functions/.env'));
  } else {
    console.log(
      chalk.gray('supabase/functions/.env already exists. Skipping creation.')
    );
  }
}

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
  revalidateEntityViaMuxApi: false,
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

  let configContent = fs.readFileSync(configPath, 'utf-8');

  // Check if [functions.mux-webhook] section with verify_jwt = false already exists
  const muxWebhookSectionRegex = /^\[functions\.mux-webhook\]\s*$/m;
  const verifyJwtRegex = /^\s*verify_jwt\s*=\s*false\s*$/m;

  const hasMuxWebhookSection = muxWebhookSectionRegex.test(configContent);

  if (hasMuxWebhookSection) {
    // Check if verify_jwt = false exists in the mux-webhook section
    const lines = configContent.split('\n');
    let inMuxWebhookSection = false;
    let hasVerifyJwt = false;

    for (const line of lines) {
      if (line.match(muxWebhookSectionRegex)) {
        inMuxWebhookSection = true;
        continue;
      }

      if (inMuxWebhookSection) {
        // If we hit another section, we're done with mux-webhook section
        if (line.match(/^\[.*\]$/)) {
          break;
        }

        if (line.match(verifyJwtRegex)) {
          hasVerifyJwt = true;
          break;
        }
      }
    }

    if (hasVerifyJwt) {
      console.log(
        chalk.gray(
          'config.toml already has verify_jwt = false for mux-webhook function'
        )
      );
      return;
    }
  }

  // Add the configuration
  const configToAdd = hasMuxWebhookSection
    ? '\nverify_jwt = false\n'
    : '\n[functions.mux-webhook]\nverify_jwt = false\n';

  if (hasMuxWebhookSection) {
    // Find the mux-webhook section and add verify_jwt after it
    const lines = configContent.split('\n');
    const newLines = [];
    let inMuxWebhookSection = false;
    let addedVerifyJwt = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      newLines.push(line);

      if (line.match(muxWebhookSectionRegex)) {
        inMuxWebhookSection = true;
        continue;
      }

      if (inMuxWebhookSection && !addedVerifyJwt) {
        // If we hit another section or end of file, add verify_jwt before it
        if (line.match(/^\[.*\]$/) || i === lines.length - 1) {
          if (line.match(/^\[.*\]$/)) {
            // Insert before the new section
            newLines.splice(-1, 0, 'verify_jwt = false');
          } else {
            // Add at the end
            newLines.push('verify_jwt = false');
          }
          addedVerifyJwt = true;
          inMuxWebhookSection = false;
        }
      }
    }

    configContent = newLines.join('\n');
  } else {
    // Append the entire section at the end
    configContent += configToAdd;
  }

  fs.writeFileSync(configPath, configContent);
  console.log(
    chalk.green(
      '✅ Added verify_jwt = false to [functions.mux-webhook] in config.toml'
    )
  );
}

async function setupMuxWebhook(): Promise<void> {
  const muxWebhookDir = path.join(supabaseDir, 'functions', 'mux-webhook');

  const shouldCreate = await shouldOverwriteMuxWebhook(muxWebhookDir);

  if (shouldCreate) {
    createMuxWebhookFunction(muxWebhookDir);
    updateSupabaseConfig();
  }
}

async function promptForDatabaseUrl(): Promise<string> {
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'input',
      name: 'databaseUrl',
      message:
        'Enter your Supabase database URL:\n' +
        '  (Click the "Connect" button in the Supabase dashboard and use the\n' +
        '   "Session pooler" option toward the bottom. Replace [YOUR-PASSWORD]\n' +
        '   with the database password you configured when setting up your project)',
      validate: (input: string) => {
        if (!input) return 'Database URL is required';
        if (!input.includes('postgresql://'))
          return 'Please enter a valid PostgreSQL connection string';
        return true;
      },
    },
  ]);

  return answers.databaseUrl;
}

function displayNextSteps(): void {
  console.log(chalk.blue.bold('\n🎉 Setup completed successfully!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(
    '1. Run migrations on production: ' + chalk.cyan('supabase migration up')
  );
  console.log('2. Configure Supabase Edge Function secrets:');
  console.log('   - MUX_TOKEN_ID: Your Mux token ID');
  console.log('   - MUX_TOKEN_SECRET: Your Mux token secret');
  console.log('   - MUX_WEBHOOK_SECRET: A secret key for webhook verification');
  console.log(
    '2. Deploy the Edge Function: ' +
      chalk.cyan('supabase functions deploy mux-webhook')
  );
  console.log(
    '3. Configure your Mux webhook to point to your Supabase function URL'
  );
  console.log('4. Test the webhook with a Mux event');
  console.log(
    chalk.gray(
      '\n💡 Tip: You can set secrets in Supabase Dashboard > Settings > Edge Functions > Secrets'
    )
  );
  console.log(
    chalk.gray(
      '   Or via CLI: supabase secrets set MUX_TOKEN_ID="your-id" MUX_TOKEN_SECRET="your-secret" MUX_WEBHOOK_SECRET="your-webhook-secret"'
    )
  );
}

async function setupDatabase(): Promise<void> {
  await createMigrationFiles(migrations);

  const databaseUrl = await promptForDatabaseUrl();
  // Init DB
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
  });

  // Ensure schema exists, not doing it via migration to not break current migration checksums
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS mux;`);
  } finally {
    await client.end();
  }
}

export async function initCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 Mux Sync Engine - Supabase Initialization'));
  console.log(
    chalk.gray(
      'This will create a Supabase Edge Function example in your Supabase database and create migration files.\n'
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
