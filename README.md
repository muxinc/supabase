README:

# Add env vars to Edge Functions in the supabase dashboard

- In the Supabase *Edge Functions* dashboard, add Mux env vars:
- `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`

Note that after updating env vars your functions have to be re-deployed. Keep this in mind when updating env variables.

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

- calling `handleMuxWebhook(req)` will run all of your workflows (more on that in a second)

3. Create a `mux.toml` file in the `supabase/functions/mux-webhook/` directory. This is a placeholder for now. You'll need this to configure workflows.

4. The very last step is to deploy the webhook handler `npm run functions:deploy` will deploy your functions to supabase.
  - Open up the supabase dashboard and copy the `mux-webhook` function URL, it should look something like: `https://xxxxxxx.supabase.co/functions/v1/mux-webhook`
  - Go to the Mux dashboard and configure this webhook endpoint for your environment
  - Make sure the environment on Mux's side where you are configuring this webhook matches the environment that your API keys are configured for in this project

# Create workflows

Workflows is code that you run with your own business logic which can include calls out to LLMS or whatever your heart desires.

Let's use the example of creating a workflow to handle **content moderation** -- a common thing that UGC platforms need to build.

To create a workflow, start with a standard supabase function:


```
npx supabase functions new content-moderation
```

_open up supabase/config.toml and set `verify_jwt = false` for this function_

- This will create a function in the directory (just like any supabase function): `supabase/functions/content-moderation/`

Now comes the magic, open up `supabase/functions/mux-webhook/mux.toml` and add the trigger for this function:

This says that the `content-moderation` workflow defined in `supabase/functions/content-moderation` will be triggered when the `video.asset.ready` webhook fires

```
# mux.toml
[workflows.content-moderation]
events = ["video.asset.ready"]
```

# Commands

`npm run migrate` -- will run supabase migrations

# TODO

- [ ] Run linting in CI
- [ ] Add tests
- [ ] Fix lint warnings around using TS `any`
- [ ] Fix lint warnings around using TS `any`
- [ ] Add webhook signature verification
