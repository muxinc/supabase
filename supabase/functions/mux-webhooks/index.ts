import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts';

console.log('Mux Webhooks Function loaded');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const muxWebhookSecret = Deno.env.get('MUX_WEBHOOK_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MuxWebhookPayload {
  type: string;
  object: {
    type: string;
    id: string;
  };
  id: string;
  environment: {
    name: string;
    id: string;
  };
  data: any;
  created_at: string;
  accessor: string;
  accessor_source: string;
  request_id: string;
}

async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  if (!muxWebhookSecret || !signature) {
    return false;
  }

  const expectedSignature = await hmac(
    'sha256',
    muxWebhookSecret,
    body,
    'utf8',
    'hex'
  );
  return signature === expectedSignature;
}

async function handleAssetWebhook(payload: MuxWebhookPayload) {
  const { data, type } = payload;

  if (type === 'video.asset.created' || type === 'video.asset.updated') {
    const assetData = {
      mux_asset_id: data.id,
      status: data.status,
      duration: data.duration,
      max_stored_resolution: data.max_stored_resolution,
      max_stored_frame_rate: data.max_stored_frame_rate,
      aspect_ratio: data.aspect_ratio,
      playback_ids: data.playback_ids || [],
      tracks: data.tracks || [],
      errors: data.errors || [],
      master_access: data.master_access,
      mp4_support: data.mp4_support,
      normalize_audio: data.normalize_audio,
      static_renditions: data.static_renditions || {},
      test: data.test,
      passthrough: data.passthrough,
      live_stream_id: data.live_stream_id,
      encoding_tier: data.encoding_tier,
      ingest_type: data.ingest_type,
      source_asset_id: data.source_asset_id,
      per_title_encode: data.per_title_encode,
      upload_id: data.upload_id,
      input_info: data.input_info || {},
      video_quality: data.video_quality,
      resolution_tier: data.resolution_tier,
      non_standard_input_reasons: data.non_standard_input_reasons || [],
      is_live: data.is_live,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('mux_assets').upsert(assetData, {
      onConflict: 'mux_asset_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error('Error upserting asset:', error);
      throw error;
    }

    console.log(`Processed asset webhook: ${type} for asset ${data.id}`);
  } else if (type === 'video.asset.deleted') {
    const { error } = await supabase
      .from('mux_assets')
      .delete()
      .eq('mux_asset_id', data.id);

    if (error) {
      console.error('Error deleting asset:', error);
      throw error;
    }

    console.log(`Deleted asset: ${data.id}`);
  }
}

async function handleLiveStreamWebhook(payload: MuxWebhookPayload) {
  const { data, type } = payload;

  if (
    type === 'video.live_stream.created' ||
    type === 'video.live_stream.updated'
  ) {
    const streamData = {
      mux_live_stream_id: data.id,
      status: data.status,
      stream_key: data.stream_key,
      active_asset_id: data.active_asset_id,
      recent_asset_ids: data.recent_asset_ids || [],
      playback_ids: data.playbook_ids || [],
      new_asset_settings: data.new_asset_settings || {},
      passthrough: data.passthrough,
      audio_only: data.audio_only,
      embedded_subtitles: data.embedded_subtitles || [],
      generated_subtitles: data.generated_subtitles || [],
      latency_mode: data.latency_mode,
      test: data.test,
      max_continuous_duration: data.max_continuous_duration,
      reconnect_window: data.reconnect_window,
      use_slate_for_standard_latency: data.use_slate_for_standard_latency,
      reconnect_slate_url: data.reconnect_slate_url,
      reduced_latency: data.reduced_latency,
      low_latency: data.low_latency,
      simulcast_targets: data.simulcast_targets || [],
      target_latency: data.target_latency,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('mux_live_streams')
      .upsert(streamData, {
        onConflict: 'mux_live_stream_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error upserting live stream:', error);
      throw error;
    }

    console.log(`Processed live stream webhook: ${type} for stream ${data.id}`);
  } else if (type === 'video.live_stream.deleted') {
    const { error } = await supabase
      .from('mux_live_streams')
      .delete()
      .eq('mux_live_stream_id', data.id);

    if (error) {
      console.error('Error deleting live stream:', error);
      throw error;
    }

    console.log(`Deleted live stream: ${data.id}`);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.text();
    const signature = req.headers.get('mux-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    const isValid = await verifyWebhookSignature(body, signature);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload: MuxWebhookPayload = JSON.parse(body);
    console.log(`Received webhook: ${payload.type}`);

    if (payload.object.type === 'asset') {
      await handleAssetWebhook(payload);
    } else if (payload.object.type === 'live_stream') {
      await handleLiveStreamWebhook(payload);
    } else {
      console.log(`Unhandled webhook type: ${payload.type}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
