import { describe, it, expect, beforeEach, afterEach, vitest } from 'vitest';
import { Client } from 'pg';
import { MuxSync } from '../muxSync';
import { runMigrations } from '../database/migrate';
import { getTestDatabaseUrl } from './setup';
import { mockMux, mockWebhookEvents } from './helpers/mockMux';

describe('processWebhook', () => {
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

    // Force close all active connections with timeout
    const cleanup = async () => {
      const cleanupPromises = [];

      // Close MuxSync pool connections first
      if (muxSync && muxSync.postgresClient && muxSync.postgresClient.pool) {
        cleanupPromises.push(muxSync.postgresClient.pool.end().catch(() => {}));
      }

      // Close test client connection
      if (client) {
        cleanupPromises.push(client.end().catch(() => {}));
      }

      await Promise.allSettled(cleanupPromises);
    };

    // Run cleanup with a timeout to prevent hanging
    try {
      await Promise.race([
        cleanup(),
        new Promise((_, reject) =>
          global.setTimeout(() => reject(new Error('Cleanup timeout')), 2000)
        ),
      ]);
    } catch {
      // Force kill connections if cleanup fails
      if (client) {
        client.end();
      }
    }
  });

  it('should process asset ready webhook', async () => {
    const payload = JSON.stringify(mockWebhookEvents.assetReady);
    const headers = { 'mux-signature': 'test_signature' };

    await muxSync.processWebhook(payload, headers);

    // Verify webhook event was stored
    const eventResult = await client.query(
      'SELECT * FROM mux.webhook_events WHERE id = $1',
      [mockWebhookEvents.assetReady.id]
    );
    expect(eventResult.rows).toHaveLength(1);
    expect(eventResult.rows[0].type).toBe('video.asset.ready');
    expect(eventResult.rows[0].raw_body).toEqual(mockWebhookEvents.assetReady.data);
    expect(eventResult.rows[0].headers).toEqual(headers);

    // Verify asset was upserted
    const assetResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      [mockWebhookEvents.assetReady.data.id]
    );
    expect(assetResult.rows).toHaveLength(1);
    expect(assetResult.rows[0].status).toBe('ready');
  });

  it('should process asset created webhook', async () => {
    const payload = JSON.stringify(mockWebhookEvents.assetCreated);
    const headers = { 'mux-signature': 'test_signature' };

    await muxSync.processWebhook(payload, headers);

    // Verify asset was created in database
    const assetResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      [mockWebhookEvents.assetCreated.data.id]
    );
    expect(assetResult.rows).toHaveLength(1);
    expect(assetResult.rows[0].status).toBe('preparing');
  });

  it('should process live stream active webhook', async () => {
    const payload = JSON.stringify(mockWebhookEvents.liveStreamActive);
    const headers = { 'mux-signature': 'test_signature' };

    await muxSync.processWebhook(payload, headers);

    // Verify live stream was upserted
    const liveStreamResult = await client.query(
      'SELECT * FROM mux.live_streams WHERE id = $1',
      [mockWebhookEvents.liveStreamActive.data.id]
    );
    expect(liveStreamResult.rows).toHaveLength(1);
    expect(liveStreamResult.rows[0].status).toBe('active');
    expect(liveStreamResult.rows[0].active_asset_id).toBe('asset_test_123');
  });

  it('should process upload completed webhook', async () => {
    const payload = JSON.stringify(mockWebhookEvents.uploadCompleted);
    const headers = { 'mux-signature': 'test_signature' };

    await muxSync.processWebhook(payload, headers);

    // Verify upload was upserted
    const uploadResult = await client.query(
      'SELECT * FROM mux.uploads WHERE id = $1',
      [mockWebhookEvents.uploadCompleted.data.id]
    );
    expect(uploadResult.rows).toHaveLength(1);
    expect(uploadResult.rows[0].status).toBe('asset_created');
    expect(uploadResult.rows[0].asset_id).toBe('asset_test_123');
  });

  it('should handle asset deleted webhook', async () => {
    // First create an asset
    const createEvent = mockWebhookEvents.assetReady;
    await muxSync.processWebhook(JSON.stringify(createEvent), {
      'mux-signature': 'test',
    });

    // Verify asset exists
    let assetResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      [createEvent.data.id]
    );
    expect(assetResult.rows).toHaveLength(1);

    // Now process delete webhook
    const deleteEvent = {
      id: 'webhook_asset_deleted_123',
      type: 'video.asset.deleted',
      created_at: 1640995500,
      data: {
        id: createEvent.data.id,
      },
      environment: { id: 'env_test_123', name: 'test' },
      attempts: [],
      object: { type: 'event' },
    };

    await muxSync.processWebhook(JSON.stringify(deleteEvent), {
      'mux-signature': 'test',
    });

    // Verify asset was deleted
    assetResult = await client.query('SELECT * FROM mux.assets WHERE id = $1', [
      createEvent.data.id,
    ]);
    expect(assetResult.rows).toHaveLength(0);
  });

  it('should handle live stream deleted webhook', async () => {
    // First create a live stream
    const createEvent = mockWebhookEvents.liveStreamActive;
    await muxSync.processWebhook(JSON.stringify(createEvent), {
      'mux-signature': 'test',
    });

    // Verify live stream exists
    let liveStreamResult = await client.query(
      'SELECT * FROM mux.live_streams WHERE id = $1',
      [createEvent.data.id]
    );
    expect(liveStreamResult.rows).toHaveLength(1);

    // Now process delete webhook
    const deleteEvent = {
      id: 'webhook_live_stream_deleted_123',
      type: 'video.live_stream.deleted',
      created_at: 1640995500,
      data: {
        id: createEvent.data.id,
      },
      environment: { id: 'env_test_123', name: 'test' },
      attempts: [],
      object: { type: 'event' },
    };

    await muxSync.processWebhook(JSON.stringify(deleteEvent), {
      'mux-signature': 'test',
    });

    // Verify live stream was deleted
    liveStreamResult = await client.query(
      'SELECT * FROM mux.live_streams WHERE id = $1',
      [createEvent.data.id]
    );
    expect(liveStreamResult.rows).toHaveLength(0);
  });

  it('should handle unknown webhook type gracefully', async () => {
    const unknownEvent = {
      id: 'webhook_unknown_123',
      type: 'video.unknown.event',
      created_at: 1640995500,
      data: {
        id: 'unknown_test_123',
      },
      environment: { id: 'env_test_123', name: 'test' },
      attempts: [],
      object: { type: 'event' },
    };

    // Should not throw error
    await expect(
      muxSync.processWebhook(JSON.stringify(unknownEvent), {
        'mux-signature': 'test',
      })
    ).resolves.toBeUndefined();

    // Should still store the webhook event
    const eventResult = await client.query(
      'SELECT * FROM mux.webhook_events WHERE id = $1',
      [unknownEvent.id]
    );
    expect(eventResult.rows).toHaveLength(1);
    expect(eventResult.rows[0].type).toBe('video.unknown.event');
  });

  it('should handle webhook with revalidateEntityViaMuxApi enabled', async () => {
    // Create MuxSync with revalidateEntityViaMuxApi enabled
    const muxSyncWithRevalidation = new MuxSync({
      databaseUrl,
      muxTokenId: 'test_token_id',
      muxTokenSecret: 'test_token_secret',
      muxWebhookSecret: 'test_webhook_secret',
      revalidateEntityViaMuxApi: true,
      logger: {
        info: vitest.fn(),
        warn: vitest.fn(),
        error: vitest.fn(),
        debug: vitest.fn(),
      },
    });

    vitest
      .spyOn(muxSyncWithRevalidation, 'mux', 'get')
      .mockReturnValue(mockMux as any);

    const payload = JSON.stringify(mockWebhookEvents.assetReady);
    const headers = { 'mux-signature': 'test_signature' };

    await muxSyncWithRevalidation.processWebhook(payload, headers);

    // Verify the retrieve method was called to revalidate
    expect(mockMux.video.assets.retrieve).toHaveBeenCalledWith(
      mockWebhookEvents.assetReady.data.id
    );

    // Verify asset was still upserted
    const assetResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      [mockWebhookEvents.assetReady.data.id]
    );
    expect(assetResult.rows).toHaveLength(1);
  });

  it('should handle track events by updating parent asset', async () => {
    const trackEvent = {
      id: 'webhook_track_ready_123',
      type: 'video.asset.track.ready',
      created_at: 1640995500,
      data: {
        id: 'track_test_123',
        asset_id: 'asset_test_123',
        type: 'video',
        max_width: 1920,
        max_height: 1080,
      },
      environment: { id: 'env_test_123', name: 'test' },
      attempts: [],
      object: { type: 'event' },
    };

    await muxSync.processWebhook(JSON.stringify(trackEvent), {
      'mux-signature': 'test',
    });

    // Verify the asset retrieve was called (to update the asset with track info)
    expect(mockMux.video.assets.retrieve).toHaveBeenCalledWith(
      'asset_test_123'
    );

    // Verify asset was upserted
    const assetResult = await client.query(
      'SELECT * FROM mux.assets WHERE id = $1',
      ['asset_test_123']
    );
    expect(assetResult.rows).toHaveLength(1);
  });

  it('should store webhook event even if processing fails', async () => {
    // Store original mock to restore later
    const originalMuxSpy = vitest.spyOn(muxSync, 'mux', 'get');

    try {
      // Mock Mux API to throw error
      const errorMockMux = {
        ...mockMux,
        video: {
          ...mockMux.video,
          assets: {
            retrieve: vitest.fn(() => Promise.reject(new Error('API Error'))),
          },
        },
        webhooks: mockMux.webhooks,
      };
      originalMuxSpy.mockReturnValue(errorMockMux as any);

      const payload = JSON.stringify(mockWebhookEvents.assetReady);
      const headers = { 'mux-signature': 'test_signature' };

      // This should not throw - the error should be handled gracefully
      await expect(
        muxSync.processWebhook(payload, headers)
      ).resolves.not.toThrow();

      // But webhook event should still be stored
      const eventResult = await client.query(
        'SELECT * FROM mux.webhook_events WHERE id = $1',
        [mockWebhookEvents.assetReady.id]
      );
      expect(eventResult.rows).toHaveLength(1);
    } finally {
      // Always restore the original mock
      originalMuxSpy.mockReturnValue(mockMux as any);
    }
  });
});
