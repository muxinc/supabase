# Mux Sync Engine

Mux Sync Engine is a service that syncs Mux data to Postgres based on webhooks. It provides an easy way to keep your database in sync with your Mux assets, live streams, and uploads.

## Features

- **Automatic webhook signature verification**: Ensures webhook events are genuine and from Mux
- **Webhook callbacks**: Run custom logic on webhook events
- **Complete Mux event syncing**: All Mux webhook events are synced to database tables for further analysis
- **Backfill support**: Sync existing Mux data to your database
- **Related entity backfilling**: Automatically ensures foreign key integrity by fetching related entities

## What gets synced

The following Mux resources are automatically synced to your Postgres database under the `mux` schema:

- **Assets** (`assets`): Video assets, including encoding status, playback IDs, and metadata
- **Live Streams** (`live_streams`): Live streaming configurations and status
- **Uploads** (`uploads`): Direct upload URLs and their status
- **Webhook Events** (`webhook_events`): All webhook events for audit and debugging
- **Webhook Event Payloads** (`webhook_event_payloads`): Complete webhook payloads

## Installation

```bash
npm install @r-delfino/mux-sync-engine
```

## Usage

### Basic Setup

```typescript
import { MuxSync, runMigrations } from '@r-delfino/mux-sync-engine';

// Run database migrations first
await runMigrations({
  databaseUrl: 'postgresql://user:password@localhost:5432/database',
});

// Initialize the sync engine
const muxSync = new MuxSync({
  databaseUrl: 'postgresql://user:password@localhost:5432/database',
  muxTokenId: 'your-mux-token-id',
  muxTokenSecret: 'your-mux-token-secret',
  muxWebhookSecret: 'your-webhook-secret',
});

// Process a webhook (in your webhook handler)
app.post('/webhook', async (req, res) => {
  try {
    await muxSync.processWebhook(req.body, req.headers);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(400).send('Bad Request');
  }
});
```

### Configuration Options

```typescript
const muxSync = new MuxSync({
  databaseUrl: 'postgresql://user:password@localhost:5432/database',
  muxTokenId: 'your-mux-token-id',
  muxTokenSecret: 'your-mux-token-secret',
  muxWebhookSecret: 'your-webhook-secret',
  
  // Optional: Backfill related entities to ensure foreign key integrity
  backfillRelatedEntities: true,
  
  // Optional: Always fetch fresh data from Mux API instead of using webhook data
  revalidateEntityViaMuxApi: false,
  
  // Optional: Maximum number of Postgres connections
  maxPostgresConnections: 10,
  
  // Optional: Custom logger
  logger: console,
});
```

### Backfilling Existing Data

You can backfill existing Mux data to your database:

```typescript
// Backfill all data
const result = await muxSync.syncBackfill({ object: 'all' });
console.log(`Synced ${result.muxAssets?.synced} assets`);
console.log(`Synced ${result.muxLiveStreams?.synced} live streams`);
console.log(`Synced ${result.muxUploads?.synced} uploads`);

// Backfill specific object types
await muxSync.syncBackfill({ object: 'mux_assets' });
await muxSync.syncBackfill({ object: 'mux_live_streams' });
await muxSync.syncBackfill({ object: 'mux_uploads' });
```

## Database Schema

The sync engine creates tables under the `mux` schema:

- `mux.mux_assets` - Video assets with encoding status and playback information
- `mux.mux_live_streams` - Live streaming configurations
- `mux.mux_uploads` - Direct upload URLs and status
- `mux.mux_webhook_events` - Webhook event metadata
- `mux.mux_webhook_event_payloads` - Complete webhook payloads


### Supabase Edge Function Example

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { MuxSync } from 'npm:@r-delfino/mux-sync-engine';

const muxSync = new MuxSync({
  databaseUrl: Deno.env.get('SUPABASE_DB_URL')!,
  muxTokenId: Deno.env.get('MUX_TOKEN_ID')!,
  muxTokenSecret: Deno.env.get('MUX_TOKEN_SECRET')!,
  muxWebhookSecret: Deno.env.get('MUX_WEBHOOK_SECRET')!,
});

serve(async (req) => {
  try {
    const body = await req.text();
    await muxSync.processWebhook(body, req.headers);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return new Response('Bad Request', { status: 400 });
  }
});
```

## Development

### Building

```bash
npm install
npm run build
```

### Testing

This package includes comprehensive tests using Vitest and Testcontainers:

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run only stable tests (for CI)
./scripts/test-ci.sh
```

#### Test Structure

- `src/test/migrations.test.ts` - Tests for database migrations
- `src/test/backfill-simple.test.ts` - Basic tests for sync functionality
- `src/test/helpers/mockMux.ts` - Mock objects for Mux API

#### CI/CD

The tests are designed to run in CI environments. See `.github/workflows/test.yml` for GitHub Actions configuration.

For local development, tests use Testcontainers to spin up a PostgreSQL instance automatically.

### Local Development

For local testing and development, you can use Docker Compose:

```bash
# Start PostgreSQL for testing
docker-compose -f docker-compose.test.yml up -d

# Run tests against local database
TEST_DATABASE_URL=postgresql://test_user:test_password@localhost:5432/test_mux_sync npm test

# Stop PostgreSQL
docker-compose -f docker-compose.test.yml down
```

## Environment Variables

The following environment variables are required:

- `MUX_TOKEN_ID` - Your Mux token ID
- `MUX_TOKEN_SECRET` - Your Mux token secret  
- `MUX_WEBHOOK_SECRET` - Your webhook signing secret
- `DATABASE_URL` - PostgreSQL connection string

## Supported Webhook Events

The sync engine handles all Mux webhook events, including:

- `video.asset.created`
- `video.asset.ready`
- `video.asset.errored`
- `video.asset.updated`
- `video.asset.deleted`
- `video.live_stream.created`
- `video.live_stream.connected`
- `video.live_stream.recording`
- `video.live_stream.active`
- `video.live_stream.disconnected`
- `video.live_stream.idle`
- `video.live_stream.updated`
- `video.live_stream.deleted`
- `video.upload.created`
- `video.upload.asset_created` 
- `video.upload.cancelled`
- `video.upload.timeout`
- `video.upload.errored`

## License

MIT
