// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import type { UnwrapWebhookEvent } from 'https://esm.sh/@mux/mux-node@12';

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { writeWorkflowOutput } from '../../../lib/workflow-output.ts'
import { z } from 'zod';

const deliveryDomain = "mux.com"; // replace this with a custom delivery domain if that's what you're using

const anthropic = createAnthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')
});

export function getImageBaseUrl() {
  return `https://image.${deliveryDomain}`;
}

export function getThumbnailUrls ({ playbackId, duration }: { playbackId: string, duration: number }): string[] {
  const timestamps = [(duration * 0.25), (duration * 0.33),  (duration * 0.5), (duration * 0.66), (duration * 0.75)];
  const urls = timestamps.map((time) => `${getImageBaseUrl()}/${playbackId}/thumbnail.png?time=${time}`);
  return urls;
}

async function requestModeration (imageUrls: string[]) {
  const imageParts = imageUrls.map(url => ({
    type: 'image' as const,
    image: url
  }));

  const textPart = {
    type: 'text' as const,
    text: `You are a helpful AI assistant that is in charge of content moderation for a UGC video platform.

Please analyze these ${imageUrls.length} images for content moderation and provide scores for adult content, suggestive content, and violence (0-1 scale for each).

Return ONLY a valid JSON object with a "scores" array containing one object per image with:
- url: the image URL
- adult: score from 0-1 for adult content
- suggestive: score from 0-1 for suggestive content
- violence: score from 0-1 for violence

Example format:
{
  "scores": [
    { "url": "${imageUrls[0] || 'example.jpg'}", "adult": 0.1, "suggestive": 0.2, "violence": 0.0 }
  ]
}

Please maintain the same order as the images provided and return only the JSON, no other text.`
  };

  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages: [
      {
        role: 'user',
        content: [textPart, ...imageParts]
      }
    ]
  });

  try {
    const parsedResult = JSON.parse(text);
    console.log('moderation result', parsedResult);
    return parsedResult;
  } catch (error) {
    console.error('Failed to parse moderation response:', error);
    console.log('Raw response:', text);
    throw new Error('Failed to parse moderation response as JSON');
  }
}

Deno.serve(async (req) => {
  const start = new Date();
  const event = (await req.json() as UnwrapWebhookEvent);
  const asset = event.data
  if (!asset) {
    console.log('No asset');
    return new Response('No asset provided', { status: 400 });
  }
  const duration = asset.duration
  if (!duration) {
    console.log('No duration');
    return new Response('No duration provided', { status: 400 });
  }
  const playbackId = asset.playback_ids && asset.playback_ids[0] && asset.playback_ids[0].id;
  if (!playbackId) {
    console.log('No playbackId');
    return new Response('No playbackId provided', { status: 400 });
  }
  const imageUrls = getThumbnailUrls({playbackId: playbackId, duration: duration });
  const resp = await requestModeration(imageUrls);
  const complete = new Date();
  try {
    await writeWorkflowOutput({
      slug: 'content-moderation',
      version: '1',
      started_at: start,
      completed_at: complete,
      mux_asset_id: asset.id,
      output_data: resp
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in content moderation function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/content-moderation' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
