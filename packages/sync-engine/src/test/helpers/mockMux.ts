import { vitest } from 'vitest';

// Creates an AsyncIterable from an array
export function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

export const mockMux = {
  video: {
    assets: {
      list: vitest.fn(() => {
        const items = [
          {
            id: 'asset_test_123',
            status: 'ready',
            created_at: '1640995200',
            duration: 120.5,
            max_stored_resolution: 'HD',
            max_stored_frame_rate: 30,
            aspect_ratio: '16:9',
            playbook_id: 'playbook_test_123',
            tracks: [
              {
                id: 'track_test_123',
                type: 'video',
                max_width: 1920,
                max_height: 1080,
                max_frame_rate: 30,
              },
            ],
          },
          {
            id: 'asset_test_456',
            status: 'preparing',
            created_at: '1640995300',
            duration: 60.0,
            max_stored_resolution: 'FHD',
            max_stored_frame_rate: 60,
            aspect_ratio: '16:9',
          },
        ];
        return createAsyncIterable(items);
      }),
      retrieve: vitest.fn((id) =>
        Promise.resolve({
          id: id,
          status: 'ready',
          created_at: '1640995200',
          duration: 120.5,
          max_stored_resolution: 'HD',
          max_stored_frame_rate: 30,
          aspect_ratio: '16:9',
          playbook_id: 'playbook_test_123',
          tracks: [
            {
              id: 'track_test_123',
              type: 'video',
              max_width: 1920,
              max_height: 1080,
              max_frame_rate: 30,
            },
          ],
        })
      ),
    },
    liveStreams: {
      list: vitest.fn(() => {
        const items = [
          {
            id: 'live_stream_test_123',
            status: 'active',
            created_at: '1640995200',
            stream_key: 'test_stream_key_123',
            active_asset_id: 'asset_test_123',
            reconnect_window: 60,
            max_continuous_duration: 43200,
          },
          {
            id: 'live_stream_test_456',
            status: 'idle',
            created_at: '1640995300',
            stream_key: 'test_stream_key_456',
            reconnect_window: 30,
            max_continuous_duration: 21600,
          },
        ];
        return createAsyncIterable(items);
      }),
      retrieve: vitest.fn((id) =>
        Promise.resolve({
          id: id,
          status: 'active',
          created_at: '1640995200',
          stream_key: 'test_stream_key_123',
          active_asset_id: 'asset_test_123',
          reconnect_window: 60,
          max_continuous_duration: 43200,
        })
      ),
    },
    uploads: {
      list: vitest.fn(() => {
        const pageItems = [
          {
            id: 'upload_test_123',
            url: 'https://storage.googleapis.com/mux-uploads/test123',
            status: 'asset_created',
            asset_id: 'asset_test_123',
            timeout: 3600,
            cors_origin: '*',
          },
          {
            id: 'upload_test_456',
            url: 'https://storage.googleapis.com/mux-uploads/test456',
            status: 'waiting',
            timeout: 3600,
            cors_origin: 'https://example.com',
          },
        ];
        return {
          getPaginatedItems: () => pageItems,
          hasNextPage: () => false,
          getNextPage: async () => ({
            getPaginatedItems: () => [],
            hasNextPage: () => false,
            getNextPage: async () => null,
          }),
        } as any;
      }),
      retrieve: vitest.fn((id) =>
        Promise.resolve({
          id: id,
          url: 'https://storage.googleapis.com/mux-uploads/test123',
          status: 'asset_created',
          asset_id: 'asset_test_123',
          timeout: 3600,
          cors_origin: '*',
        })
      ),
    },
  },
  webhooks: {
    unwrap: vitest.fn(async (payload, _headers) => {
      // Mock webhook unwrapping - in real implementation this verifies signature
      const event = JSON.parse(payload);

      // Fixtures use epoch seconds; real payloads carry ISO strings
      const created_at = event.created_at || 1640995200;
      const createdAtISO =
        typeof created_at === 'number'
          ? new Date(created_at * 1000).toISOString()
          : new Date(parseInt(created_at) * 1000).toISOString();

      return {
        id: event.id || 'webhook_test_123',
        type: event.type || 'video.asset.ready',
        created_at: createdAtISO,
        data: event.data || {
          id: 'asset_test_123',
          status: 'ready',
        },
        environment: event.environment || {},
        attempts: event.attempts || [],
        object: event.object || { type: 'event' },
      };
    }),
  },
};

// Mock webhook events for testing
export const mockWebhookEvents = {
  assetReady: {
    id: 'webhook_asset_ready_123',
    type: 'video.asset.ready',
    created_at: 1640995200,
    data: {
      id: 'asset_test_123',
      status: 'ready',
      created_at: '1640995200',
      duration: 120.5,
      max_stored_resolution: 'HD',
      max_stored_frame_rate: 30,
      aspect_ratio: '16:9',
    },
    environment: {
      id: 'env_test_123',
      name: 'test',
    },
    attempts: [],
    object: { type: 'event' },
  },
  assetCreated: {
    id: 'webhook_asset_created_123',
    type: 'video.asset.created',
    created_at: 1640995100,
    data: {
      id: 'asset_test_789',
      status: 'preparing',
      created_at: '1640995100',
    },
    environment: {
      id: 'env_test_123',
      name: 'test',
    },
    attempts: [],
    object: { type: 'event' },
  },
  liveStreamActive: {
    id: 'webhook_live_stream_active_123',
    type: 'video.live_stream.active',
    created_at: 1640995300,
    data: {
      id: 'live_stream_test_123',
      status: 'active',
      created_at: '1640995200',
      stream_key: 'test_stream_key_123',
      active_asset_id: 'asset_test_123',
    },
    environment: {
      id: 'env_test_123',
      name: 'test',
    },
    attempts: [],
    object: { type: 'event' },
  },
  uploadCompleted: {
    id: 'webhook_upload_completed_123',
    type: 'video.upload.asset_created',
    created_at: 1640995400,
    data: {
      id: 'upload_test_123',
      status: 'asset_created',
      asset_id: 'asset_test_123',
      url: 'https://storage.googleapis.com/mux-uploads/test123',
    },
    environment: {
      id: 'env_test_123',
      name: 'test',
    },
    attempts: [],
    object: { type: 'event' },
  },
};
