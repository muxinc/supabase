#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import Mux from '@mux/mux-node';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required Supabase environment variables');
  process.exit(1);
}

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.error('Missing required Mux environment variables');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const mux = new Mux();

interface AssetData {
  mux_asset_id: string;
  status: string;
  duration?: number;
  max_stored_resolution?: string;
  max_stored_frame_rate?: number;
  aspect_ratio?: string;
  playback_ids: any[];
  tracks: any[];
  errors: { messages?: string[]; type?: string } | null;
  master_access?: string;
  mp4_support?: string;
  normalize_audio?: boolean;
  static_renditions: any;
  test?: boolean;
  passthrough?: string;
  live_stream_id?: string;
  encoding_tier?: string;
  ingest_type?: string;
  source_asset_id?: string;
  per_title_encode?: boolean;
  upload_id?: string;
  input_info: any;
  video_quality?: string;
  resolution_tier?: string;
  non_standard_input_reasons: {
    audio_codec?: string;
    audio_edit_list?: 'non-standard';
    pixel_aspect_ratio?: string;
    unexpected_media_file_parameters?: 'non-standard';
    unsupported_pixel_format?: string;
    video_bitrate?: 'high';
    video_codec?: string;
    video_edit_list?: 'non-standard';
    video_frame_rate?: string;
    video_gop_size?: 'high';
    video_resolution?: string;
  } | null;
  is_live?: boolean;
  updated_at: string;
}

interface StreamData {
  mux_live_stream_id: string;
  status: string;
  stream_key: string;
  active_asset_id?: string;
  recent_asset_ids: string[];
  playback_ids: any[];
  new_asset_settings: any;
  passthrough?: string;
  audio_only?: boolean;
  embedded_subtitles: any[];
  generated_subtitles: any[];
  latency_mode?: string;
  test?: boolean;
  max_continuous_duration?: number;
  reconnect_window?: number;
  use_slate_for_standard_latency?: boolean;
  reconnect_slate_url?: string;
  reduced_latency?: boolean;
  low_latency?: boolean;
  simulcast_targets: any[];
  target_latency?: number;
  updated_at: string;
}

async function syncAssets(): Promise<void> {
  console.log('Starting asset sync...');

  try {
    let nextCursor: string | undefined;
    let totalProcessed = 0;

    // Process assets using cursor-based pagination
    do {
      console.log(
        `Fetching and processing assets batch... (processed so far: ${totalProcessed})`
      );
      const listParams: any = { limit: 100 };
      if (nextCursor) {
        listParams.cursor = nextCursor;
      }
      const response = await mux.video.assets.list(listParams);

      // Process each asset in the current page immediately
      for (const asset of response.data) {
        const assetData: AssetData = {
          mux_asset_id: asset.id,
          status: asset.status,
          duration: asset.duration,
          max_stored_resolution: asset.max_stored_resolution,
          max_stored_frame_rate: asset.max_stored_frame_rate,
          aspect_ratio: asset.aspect_ratio,
          playback_ids: asset.playback_ids || [],
          tracks: asset.tracks || [],
          errors: asset.errors || null,
          master_access: asset.master_access,
          mp4_support: asset.mp4_support,
          normalize_audio: asset.normalize_audio,
          static_renditions: asset.static_renditions || {},
          test: asset.test,
          passthrough: asset.passthrough,
          live_stream_id: asset.live_stream_id,
          encoding_tier: asset.encoding_tier,
          ingest_type: asset.ingest_type,
          source_asset_id: asset.source_asset_id,
          per_title_encode: asset.per_title_encode,
          upload_id: asset.upload_id,
          input_info: (asset as any).input_info || {},
          video_quality: asset.video_quality,
          resolution_tier: asset.resolution_tier,
          non_standard_input_reasons: asset.non_standard_input_reasons || null,
          is_live: asset.is_live,
          updated_at: new Date().toISOString(),
        };

        // Upsert asset immediately
        const { error } = await supabase.from('mux_assets').upsert(assetData, {
          onConflict: 'mux_asset_id',
          ignoreDuplicates: false,
        });

        if (error) {
          console.error(`Error upserting asset ${asset.id}:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            error: JSON.stringify(error, null, 2),
          });
        } else {
          console.log(`Synced asset: ${asset.id}`);
        }

        totalProcessed++;
      }

      // Check if there are more results
      nextCursor = (response as any).body.next_cursor;
      console.log(`Next cursor: ${nextCursor}`);
    } while (nextCursor);

    console.log(`Asset sync completed. Processed ${totalProcessed} assets.`);
  } catch (error) {
    console.error('Error syncing assets:', error);
  }
}

async function syncLiveStreams(): Promise<void> {
  console.log('Starting live stream sync...');

  try {
    let nextCursor: string | undefined;
    let totalProcessed = 0;

    // Process live streams using cursor-based pagination
    do {
      console.log(
        `Fetching and processing live streams batch... (processed so far: ${totalProcessed})`
      );
      const listParams: any = { limit: 100 };
      if (nextCursor) {
        listParams.cursor = nextCursor;
      }
      const response = await mux.video.liveStreams.list(listParams);

      // Process each live stream in the current page immediately
      for (const stream of response.data) {
        const streamData: StreamData = {
          mux_live_stream_id: stream.id,
          status: stream.status,
          stream_key: stream.stream_key,
          active_asset_id: stream.active_asset_id,
          recent_asset_ids: stream.recent_asset_ids || [],
          playback_ids: stream.playback_ids || [],
          new_asset_settings: stream.new_asset_settings || {},
          passthrough: stream.passthrough,
          audio_only: stream.audio_only,
          embedded_subtitles: stream.embedded_subtitles || [],
          generated_subtitles: stream.generated_subtitles || [],
          latency_mode: stream.latency_mode,
          test: stream.test,
          max_continuous_duration: stream.max_continuous_duration,
          reconnect_window: stream.reconnect_window,
          use_slate_for_standard_latency: stream.use_slate_for_standard_latency,
          reconnect_slate_url: stream.reconnect_slate_url,
          reduced_latency: stream.reduced_latency,
          low_latency: stream.low_latency,
          simulcast_targets: stream.simulcast_targets || [],
          target_latency: (stream as any).target_latency,
          updated_at: new Date().toISOString(),
        };

        // Upsert live stream immediately
        const { error } = await supabase
          .from('mux_live_streams')
          .upsert(streamData, {
            onConflict: 'mux_live_stream_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Error upserting live stream ${stream.id}:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            error: JSON.stringify(error, null, 2),
          });
        } else {
          console.log(`Synced live stream: ${stream.id}`);
        }

        totalProcessed++;
      }

      // Check if there are more results
      nextCursor = (response as any).body.next_cursor;
      console.log(`Next cursor: ${nextCursor}`);
    } while (nextCursor);

    console.log(
      `Live stream sync completed. Processed ${totalProcessed} live streams.`
    );
  } catch (error) {
    console.error('Error syncing live streams:', error);
  }
}

async function main(): Promise<void> {
  console.log('Starting Mux data sync...');

  await syncAssets();
  await syncLiveStreams();

  console.log('Sync completed!');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { syncAssets, syncLiveStreams };
