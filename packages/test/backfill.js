import { MuxSync } from '@r-delfino/mux-sync-engine';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function runBackfill() {
  try {
    // Load secrets from environment variables
    const databaseUrl = process.env.DATABASE_URL;
    const muxWebhookSecret =
      process.env.MUX_WEBHOOK_SECRET || 'your-mux-webhook-secret';
    const muxTokenId = process.env.MUX_TOKEN_ID || 'your-mux-token-id';
    const muxTokenSecret =
      process.env.MUX_TOKEN_SECRET || 'your-mux-token-secret';

    console.log('Starting backfill process...');

    // Initialize MuxSync
    const muxSync = new MuxSync({
      databaseUrl,
      muxWebhookSecret,
      muxTokenId,
      muxTokenSecret,
      maxPostgresConnections: 5,
    });

    // Run the backfill
    const result = await muxSync.syncBackfill({
      object: 'all',
    });

    console.log('Backfill completed successfully!');
    console.log('Results:', result);
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
runBackfill();
