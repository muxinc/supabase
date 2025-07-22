README:

# Create a supabase webhook handler:

```
npx supabase functions new mux-webhook
```

_open up supabase/config.toml and set `verify_jwt = false` for this function_

- This will create a function in `supabase/functions/mux-webhook/`

2. Open up the webhook function that you just created and edit it

```js
// supabase/functions/mux-webhook/index.js

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
```

- calling `handleMuxWebhook(req)` will run all of your workflows

# Create workflows

Workflows is code that you run with your own business logic which can include calls out to LLMS or whatever your heart desires.

Let's use the example of creating a workflow to handle **content moderation** -- a common thing that UGC platforms need to build.

To create a workflow, start with a standard supabase function:


```
npx supabase functions new content-moderation
```

_open up supabase/config.toml and set `verify_jwt = false` for this function_

- This will create a function in the directory (just like any supabase function): `supabase/functions/content-moderation/`

Now comes the magic, add a new file called `mux.toml` in that directory, so you will now have:

```
supabase/functions/content-moderation/
                                      deno.json
                                      index.ts
                                      .npmrc
                                      mux.toml
```

- Open up `mux.toml` and add the `events` array for when you want this workflow to run:
- For our example, we want this function to run on the 'video.asset.ready' event

```
# mux.toml
events = ["video.asset.ready"]
```
