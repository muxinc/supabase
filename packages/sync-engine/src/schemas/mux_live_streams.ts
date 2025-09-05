import type { EntitySchema } from './types';

export const muxLiveStreamsSchema: EntitySchema = {
  properties: [
    'id',
    'status',
    'created_at',
    'stream_key',
    'active_asset_id',
    'recent_asset_ids',
    'playback_ids',
    'new_asset_settings',
    'passthrough',
    'audio_only',
    'embedded_subtitles',
    'generated_subtitles',
    'latency_mode',
    'test',
    'max_continuous_duration_seconds',
    'reconnect_window_seconds',
    'use_slate_for_standard_latency',
    'reconnect_slate_url',
    'active_ingest_protocol',
    'meta',
    'simulcast_targets',
    'srt_passphrase',
  ],
} as const;
