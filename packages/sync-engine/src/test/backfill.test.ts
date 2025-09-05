import { describe, it, expect, beforeEach, afterEach, vitest } from 'vitest';
import { Client } from 'pg';
import { MuxSync } from '../muxSync';
import { runMigrations } from '../database/migrate';
import { getTestDatabaseUrl } from './setup';
import { mockMux } from './helpers/mockMux';

describe('syncBackfill', () => {
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

  it('should sync all mux live streams', async () => {
    const result = await muxSync.syncBackfill({ object: 'mux_live_streams' });

    expect(result.muxLiveStreams).toBeDefined();
    expect(result.muxLiveStreams!.synced).toBe(2); // mockMux returns 2 live streams

    // Verify live streams were inserted into database
    const liveStreamsResult = await client.query(
      'SELECT * FROM mux.live_streams ORDER BY id'
    );
    expect(liveStreamsResult.rows).toHaveLength(2);

    const firstLiveStream = liveStreamsResult.rows[0];
    expect(firstLiveStream.id).toBe('live_stream_test_123');
    expect(firstLiveStream.status).toBe('active');
    expect(firstLiveStream.active_asset_id).toBe('asset_test_123');
    expect(parseInt(firstLiveStream.reconnect_window_seconds)).toBe(60);
    expect(parseInt(firstLiveStream.max_continuous_duration_seconds)).toBe(
      43200
    );
  });

  it('should sync all mux uploads', async () => {
    const result = await muxSync.syncBackfill({ object: 'mux_uploads' });

    expect(result.muxUploads).toBeDefined();
    expect(result.muxUploads!.synced).toBe(2); // mockMux returns 2 uploads

    // Verify uploads were inserted into database
    const uploadsResult = await client.query(
      'SELECT * FROM mux.uploads ORDER BY id'
    );
    expect(uploadsResult.rows).toHaveLength(2);

    const firstUpload = uploadsResult.rows[0];
    expect(firstUpload.id).toBe('upload_test_123');
    expect(firstUpload.status).toBe('asset_created');
    expect(firstUpload.asset_id).toBe('asset_test_123');
    expect(firstUpload.timeout_seconds).toBe(3600);
  });

  it('should sync all objects when object is "all"', async () => {
    const result = await muxSync.syncBackfill({ object: 'all' });

    expect(result.muxAssets).toBeDefined();
    expect(result.muxLiveStreams).toBeDefined();
    expect(result.muxUploads).toBeDefined();

    expect(result.muxAssets!.synced).toBe(2);
    expect(result.muxLiveStreams!.synced).toBe(2);
    expect(result.muxUploads!.synced).toBe(2);

    // Verify all tables have data
    const assetsResult = await client.query('SELECT COUNT(*) FROM mux.assets');
    const liveStreamsResult = await client.query(
      'SELECT COUNT(*) FROM mux.live_streams'
    );
    const uploadsResult = await client.query(
      'SELECT COUNT(*) FROM mux.uploads'
    );

    expect(parseInt(assetsResult.rows[0].count)).toBe(2);
    expect(parseInt(liveStreamsResult.rows[0].count)).toBe(2);
    expect(parseInt(uploadsResult.rows[0].count)).toBe(2);
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

  it('should handle pagination correctly', async () => {
    // Mock paginated response
    let callCount = 0;
    const paginatedMockMux = {
      video: {
        assets: {
          list: vitest.fn((_params) => {
            callCount++;
            if (callCount === 1) {
              // First page
              return Promise.resolve({
                data: [
                  {
                    id: 'asset_page_1',
                    status: 'ready',
                    created_at: '1640995200',
                  },
                ],
                next_cursor: 'next_page_cursor',
              });
            } else {
              // Second page (last page)
              return Promise.resolve({
                data: [
                  {
                    id: 'asset_page_2',
                    status: 'ready',
                    created_at: '1640995200',
                  },
                ],
                next_cursor: null,
              });
            }
          }),
        },
      },
    };
    vitest
      .spyOn(muxSync, 'mux', 'get')
      .mockReturnValue(paginatedMockMux as any);

    const result = await muxSync.syncBackfill({ object: 'mux_assets' });

    expect(result.muxAssets).toBeDefined();
    expect(result.muxAssets!.synced).toBe(2);

    // Verify pagination was called correctly
    expect(paginatedMockMux.video.assets.list).toHaveBeenCalledTimes(2);
    expect(paginatedMockMux.video.assets.list).toHaveBeenNthCalledWith(1, {
      limit: 100,
    });
    expect(paginatedMockMux.video.assets.list).toHaveBeenNthCalledWith(2, {
      limit: 100,
      cursor: 'next_page_cursor',
    });

    // Verify both assets were inserted
    const assetsResult = await client.query(
      'SELECT * FROM mux.assets ORDER BY id'
    );
    expect(assetsResult.rows).toHaveLength(2);
    expect(assetsResult.rows[0].id).toBe('asset_page_1');
    expect(assetsResult.rows[1].id).toBe('asset_page_2');
  });

  it('should update existing records on conflict', async () => {
    // First sync
    await muxSync.syncBackfill({ object: 'mux_assets' });

    // Verify initial data
    let assetsResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      ['asset_test_123']
    );
    expect(assetsResult.rows[0].status).toBe('ready');

    // Mock updated asset data
    const updatedMockMux = {
      video: {
        assets: {
          list: vitest.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'asset_test_123',
                  status: 'errored', // Changed status
                  created_at: '1640995200',
                  duration: 120.5,
                },
              ],
              next_cursor: null,
            })
          ),
        },
      },
    };
    vitest.spyOn(muxSync, 'mux', 'get').mockReturnValue(updatedMockMux as any);

    // Second sync with updated data
    await muxSync.syncBackfill({ object: 'mux_assets' });

    // Verify data was updated
    assetsResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      ['asset_test_123']
    );
    expect(assetsResult.rows[0].status).toBe('errored');

    // Verify only one record exists (no duplicate)
    const countResult = await client.query(
      'SELECT COUNT(*) FROM mux.assets WHERE id = $1',
      ['asset_test_123']
    );
    expect(parseInt(countResult.rows[0].count)).toBe(1);
  });
});
