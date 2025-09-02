// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { UnwrapWebhookEvent } from 'https://esm.sh/@mux/mux-node@12';
import Mux from 'npm:@mux/mux-node@12';
import z from 'npm:zod@4';
import { openai } from 'npm:@ai-sdk/openai@2';
import { embed, generateObject } from 'npm:ai@5';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

type VideoRow = {
  assetId: string;
  title: string;
  description: string;
  transcript: string;
  embedding: number[];
}

async function writeVideoRow ({assetId, title, description, transcript, embedding}:VideoRow) {
  const { error } = await supabase
    .from('videos')
    .upsert({
      mux_asset_id: assetId,
      title: title,
      description: description,
      transcript_en: transcript,
      embedding: embedding,
    }, {
      onConflict: 'mux_asset_id'
    });

  if (error) {
    throw error
  }
}

Deno.serve(async (req) => {
  const mux = new Mux({
    tokenId: Deno.env.get("MUX_TOKEN_ID"),
    tokenSecret: Deno.env.get("MUX_TOKEN_SECRET"),
    webhookSecret: Deno.env.get("MUX_WEBHOOK_SECRET"),
  })

  const event = (await req.json()) as UnwrapWebhookEvent;
  const track = event.data;
  if (!track) {
    console.log('No text track');
    return new Response('No text track in webhook', { status: 400 });
  }
  const trackId = track.id
  const assetId = track.asset_id
  const asset = await mux.video.assets.retrieve(assetId);

  const playbackId = asset.playback_ids[0].id;
  if (!playbackId) {
    console.log('No playbackId');
    return new Response('No playbackId on asset', { status: 400 });
  }

  try {
    const transcriptUrl = `https://stream.mux.com/${playbackId}/text/${trackId}.txt`;
    const transcriptText = await fetch(transcriptUrl).then(resp => resp.text());
    const { object } = await generateObject({
      model: openai('gpt-5'),
      schema: z.object({
        title: z.string(),
        description: z.string(),
      }),
      prompt: `Given the transcript for this video, generate a title and description\n${transcriptText}`,
    });

    const { title, description } = object;

    console.log('Got title and description', 'title=', title);

    const { embedding } = await embed({
      model: openai.textEmbeddingModel('text-embedding-3-small'),
      value: transcriptText,
    });

    console.log('Got embedding');

    await writeVideoRow({
      assetId,
      title,
      description,
      transcript: transcriptText,
      embedding
    })

    console.log(`Wrote video row for asset ID: ${assetId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in video-embedding function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
})
