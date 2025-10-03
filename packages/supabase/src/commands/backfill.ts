import chalk from 'chalk';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { MuxSync } from '@mux/sync-engine';

async function loadAllEnvironmentVariables(): Promise<{
  databaseUrl: string;
  muxTokenId: string;
  muxTokenSecret: string;
  muxWebhookSecret: string;
}> {
  // Load environment variables from various .env file locations
  const envPaths = ['.env', 'supabase/.env', 'supabase/functions/.env'];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(chalk.gray(`Loading environment variables from ${envPath}`));
      dotenv.config({ path: envPath });
      break;
    }
  }

  // Get database URL
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
  console.log(chalk.green('✅ Using SUPABASE_DB_URL from environment'));

  // Get Mux credentials
  const muxTokenId = process.env.MUX_TOKEN_ID;
  const muxTokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!muxTokenId || !muxTokenSecret) {
    console.log(
      chalk.yellow('Missing Mux credentials in environment variables.')
    );
    console.log(
      chalk.blue(
        'Please set MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables.'
      )
    );
    console.log(chalk.gray('Example: export MUX_TOKEN_ID="your-mux-token-id"'));
    console.log(chalk.gray('export MUX_TOKEN_SECRET="your-mux-token-secret"'));
    process.exit(1);
  }
  console.log(
    chalk.green('✅ Using MUX_TOKEN_ID and MUX_TOKEN_SECRET from environment')
  );

  // Get webhook secret (optional)
  const muxWebhookSecret = process.env.MUX_WEBHOOK_SECRET || '';

  return {
    databaseUrl,
    muxTokenId,
    muxTokenSecret,
    muxWebhookSecret,
  };
}

export async function backfillCommand(): Promise<void> {
  const { databaseUrl, muxTokenId, muxTokenSecret, muxWebhookSecret } =
    await loadAllEnvironmentVariables();

  const muxSync = new MuxSync({
    databaseUrl,
    muxTokenId,
    muxTokenSecret,
    muxWebhookSecret,
  });

  // Backfill assets and live streams
  const [muxAssets, muxLiveStreams] = await Promise.all([
    muxSync.syncBackfill({ object: 'mux_assets' }),
    muxSync.syncBackfill({ object: 'mux_live_streams' }),
  ]);

  console.log(`Synced ${muxAssets.muxAssets?.synced} assets`);
  console.log(`Synced ${muxLiveStreams.muxLiveStreams?.synced} live streams`);
}
