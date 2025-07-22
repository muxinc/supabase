// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import type { UnwrapWebhookEvent } from 'https://esm.sh/@mux/mux-node@12';

import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const deliveryDomain = "mux.com"; // replace this with a custom delivery domain if that's what you're using

export function getImageBaseUrl() {
  return `https://image.${deliveryDomain}`;
}

export function getThumbnailUrls ({ playbackId, duration }: { playbackId: string, duration: number }): string[] {
  const timestamps = [(duration * 0.25), (duration * 0.33),  (duration * 0.5), (duration * 0.66), (duration * 0.75)];
  const urls = timestamps.map((time) => `${getImageBaseUrl()}/${playbackId}/thumbnail.png?time=${time}`);
  return urls;
}

async function requestModeration (imageUrls: [String]) {
  const { text } = await generateText({
    model: anthropic('claude-3-haiku-20240307'),
    prompt: 'Write a vegetarian lasagna recipe for 4 people.',
  });

  const { object } = await generateObject({
    model: anthropic,
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
        steps: z.array(z.string()),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.log('text', text);
  return text;
}

Deno.serve(async (req) => {
  const event = (await req.json() as UnwrapWebhookEvent);
  const asset = event.data
  if (!asset) {
    console.log('No asset');
    return
  }
  const duration = asset.duration
  if (!duration) {
    console.log('No duration');
    return
  }
  const playbackId = asset.playback_ids && asset.playback_ids[0] && asset.playback_ids[0].id;
  if (!playbackId) {
    console.log('No playbackId');
    return
  }
  const imageUrls = getThumbnailUrls({playbackId: playbackId, duration: duration });
  const resp = await requestModeration(imageUrls);
  console.log('resp', resp);
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/content-moderation' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
