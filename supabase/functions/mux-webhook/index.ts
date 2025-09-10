// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { MuxSync } from '@mux/sync-engine'
import { Workflows } from '@mux/supabase'

// Load secrets from environment variables
const databaseUrl = Deno.env.get('SUPABASE_DB_URL') || 'postgresql://your-database-url'
const muxWebhookSecret = Deno.env.get('MUX_WEBHOOK_SECRET') || 'your-mux-webhook-secret'
const muxTokenId = Deno.env.get('MUX_TOKEN_ID') || 'your-mux-token-id'
const muxTokenSecret = Deno.env.get('MUX_TOKEN_SECRET') || 'your-mux-token-secret'

// Initialize MuxSync
const muxSync = new MuxSync({
  databaseUrl,
  muxWebhookSecret,
  muxTokenId,
  muxTokenSecret,
  backfillRelatedEntities: false,
  revalidateEntityViaMuxApi: false,
  maxPostgresConnections: 5,
  logger: console
})

// Create HTTP server handler
Deno.serve(async (req) => {
  // Only handle POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const body = await req.text()
    await muxSync.processWebhook(body, Object.fromEntries(req.headers.entries()))

    return new Response(
      JSON.stringify({ status: 'success' }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

