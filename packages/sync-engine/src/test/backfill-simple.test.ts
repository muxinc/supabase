import { describe, it, expect, beforeEach, afterEach, vitest } from 'vitest';
import { Client } from 'pg';
import { MuxSync } from '../muxSync';
import { runMigrations } from '../database/migrate';
import { getTestDatabaseUrl } from './setup';
import { mockMux } from './helpers/mockMux';

describe('syncBackfill (Simple)', () => {
  let client: Client;
  let databaseUrl: string;
  let muxSync: MuxSync;

  beforeEach(async () => {
    databaseUrl = getTestDatabaseUrl();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // Clean up any existing mux schema
    await client.query('DROP SCHEMA IF EXISTS mux CASCADE');

    // Run migrations to set up tables
    await runMigrations({ databaseUrl });

    // Create MuxSync instance with test config
    muxSync = new MuxSync({
      databaseUrl,
      muxTokenId: 'test_token_id',
      muxTokenSecret: 'test_token_secret',
      muxWebhookSecret: 'test_webhook_secret',
      logger: {
        info: vitest.fn(),
        warn: vitest.fn(),
        error: vitest.fn(),
        debug: vitest.fn(),
      },
    });

    // Mock the Mux API
    vitest.spyOn(muxSync, 'mux', 'get').mockReturnValue(mockMux as any);
  });

  afterEach(async () => {
    vitest.clearAllMocks();

    // Close MuxSync pool connections first
    if (muxSync && muxSync.postgresClient && muxSync.postgresClient.pool) {
      try {
        await muxSync.postgresClient.pool.end();
      } catch {
        // Ignore connection errors during cleanup
      }
    }

    // Close test client connection
    if (client) {
      try {
        await client.end();
      } catch {
        // Ignore connection errors during cleanup
      }
    }
  });

  it('should sync all mux assets', async () => {
    const result = await muxSync.syncBackfill({ object: 'mux_assets' });

    expect(result.muxAssets).toBeDefined();
    expect(result.muxAssets!.synced).toBe(2); // mockMux returns 2 assets

    // Verify assets were inserted into database
    const assetsResult = await client.query(
      'SELECT * FROM mux.assets ORDER BY id'
    );
    expect(assetsResult.rows).toHaveLength(2);

    const firstAsset = assetsResult.rows[0];
    expect(firstAsset.id).toBe('asset_test_123');
    expect(firstAsset.status).toBe('ready');
    expect(parseFloat(firstAsset.duration_seconds)).toBe(120.5);

    const secondAsset = assetsResult.rows[1];
    expect(secondAsset.id).toBe('asset_test_456');
    expect(secondAsset.status).toBe('preparing');
  });

  it('should handle empty response from Mux API', async () => {
    // Mock empty response
    const emptyMockMux = {
      video: {
        assets: {
          list: vitest.fn(() =>
            Promise.resolve({ data: [], next_cursor: null })
          ),
        },
      },
    };
    vitest.spyOn(muxSync, 'mux', 'get').mockReturnValue(emptyMockMux as any);

    const result = await muxSync.syncBackfill({ object: 'mux_assets' });

    expect(result.muxAssets).toBeDefined();
    expect(result.muxAssets!.synced).toBe(0);

    // Verify no assets were inserted
    const assetsResult = await client.query('SELECT COUNT(*) FROM mux.assets');
    expect(parseInt(assetsResult.rows[0].count)).toBe(0);
  });
});
