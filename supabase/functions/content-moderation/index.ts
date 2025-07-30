// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import type { UnwrapWebhookEvent } from 'https://esm.sh/@mux/mux-node@12';

import { writeWorkflowOutput } from '../../../lib/workflow-output.ts'
import OpenAI from "openai";

const deliveryDomain = "mux.com"; // replace this with a custom delivery domain if that's what you're using

const openaiClient = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

export function getImageBaseUrl() {
  return `https://image.${deliveryDomain}`;
}

export function getThumbnailUrls({ playbackId, duration }: { playbackId: string; duration: number }): string[] {
  const timestamps: number[] = [];

  if (duration <= 50) {
    // Generate 5 evenly spaced timestamps
    const interval = duration / 6; // 6 intervals → 5 points in between
    for (let i = 1; i <= 5; i++) {
      timestamps.push(Math.round(i * interval));
    }
  } else {
    // One thumbnail every 10 seconds (excluding duration if not multiple of 10)
    for (let time = 0; time < duration; time += 10) {
      timestamps.push(time);
    }
  }

  const urls = timestamps.map(
    (time) => `${getImageBaseUrl()}/${playbackId}/thumbnail.png?time=${time}`
  );

  return urls;
}


async function requestModeration(imageUrls: string[]) {
  const moderationPromises = imageUrls.map(async (url) => {
    console.log(`Moderating image: ${url}`);

    try {
      const moderation = await openaiClient.moderations.create({
        model: "omni-moderation-latest",
        input: [
          {
            type: "image_url",
            image_url: {
              url: url,
            },
          },
        ],
      });

      const categoryScores = moderation.results[0].category_scores;

      if (moderation.results[0].flagged) {
        console.warn("Image flagged for moderation.");
        console.log(`Sexual: ${categoryScores.sexual}, Violence: ${categoryScores.violence}`);
      }

      return {
        url,
        adult: categoryScores.sexual || 0,
        violence: categoryScores.violence || 0,
        suggestive: 0,
        error: false
      };

    } catch (error) {
      console.error("Failed to moderate image:", error);

      return {
        url,
        adult: 0,
        violence: 0,
        suggestive: 0,
        error: true,
      };
    }
  });

  const scores = await Promise.all(moderationPromises);
  return { scores };
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
