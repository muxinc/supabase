// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleMuxWebhook } from '../../../lib/webhook-handler'

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    await handleMuxWebhook(req)

    return new Response(
      JSON.stringify({ message: 'Webhook processed successfully' }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Webhook processing failed:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 400,
        headers: { "Content-Type": "application/json" } 
      },
    )
  }
})
