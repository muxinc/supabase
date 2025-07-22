# supabase-mux

Supabase-Mux will connect Supabase to your Mux account, so that you can build a robust Video integration driven by AI workflows that you control, while Mux handles the video infrastructure behind the scenes.

✅ What this integration does:

- Syncs data from your Mux account to Supabase
- Creates several database tables directly in your Supabase instance
- Save the current state of Mux Assets & Mux Live Streams, directly in your supabase database
- Save metadata about Assets and Live Streams in your database
- Expose integration points so that you can create your own workflows around your video data. This is not limited to “AI”, but this is the most common use case.

Think about things like: when a new asset is ready, you want to

- Create translations
- Create summarizations
- Create chapters
- Create vector embeddings
- Extract audio or thumbnails and analyze the content for tagging, labeling, grouping or content moderation

❌ What this integration DOES NOT do:

- Run AI models, decide what model to use or create prompts for you

## Step 1: Add env vars to Edge Functions in the supabase dashboard

- In the Supabase *Edge Functions* dashboard, add Mux env vars:
- `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`

Note that after updating env vars your functions have to be re-deployed. Keep this in mind when updating env variables.

## Step 2: Create a supabase webhook handler:

```
npx supabase functions new mux-webhook
```

Open up `supabase/config.toml` and set `verify_jwt = false` for this function

- This will create a function in `supabase/functions/mux-webhook/`

2. Open up the webhook function that you just created and edit it to connect the `handleMuxWebhook` handler

```js
// supabase/functions/mux-webhook/index.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleMuxWebhook } from '../../../lib/webhook-handler'

Deno.serve(handleMuxWebhook);
```

- calling `handleMuxWebhook(req)` will run all of your workflows

The very last step is to deploy the webhook handler `npm run functions:deploy` will deploy your functions to supabase.
  - Open up the supabase dashboard and copy the `mux-webhook` function URL, it should look something like: `https://xxxxxxx.supabase.co/functions/v1/mux-webhook`
  - Go to the Mux dashboard and configure this webhook endpoint for your environment
  - Make sure the environment on Mux's side where you are configuring this webhook matches the environment that your API keys are configured for in this project

## Step 3: Create your workflows

Workflows are code that you run with your own business logic which can include calls out to LLMS or whatever you want to do.

Let's use the example of creating a workflow to handle **content moderation** -- a common thing that UGC platforms need to build.

To create a workflow, start with a standard supabase function:


```
npx supabase functions new content-moderation
```

Open `supabase/config.toml` and set `verify_jwt = false` for this function

- This will create a function in the directory (just like any supabase function): `supabase/functions/content-moderation/`

Now comes the magic, create a file in the `mux-webhook` directory called mux.toml: `supabase/functions/mux-webhook/mux.toml`. Add a trigger for this function:

This says that the `content-moderation` workflow defined in `supabase/functions/content-moderation` will be triggered when the `video.asset.ready` webhook fires

```
# mux.toml
[workflows.content-moderation]
events = ["video.asset.ready"]
```

## Example workflow file

The only thing you need to do in your workflow file is call:

```js
await writeWorkflowOutput({
  slug: 'content-moderation', // slug is an identifier for the workflow
  version: '1.1',            // version for this workflow
  mux_asset_id: '1.1',       // every workflow should correspond to a MuxAsset
  started_at: new Date(),
  completed_at: new Date(),
  output_data: {}            // arbitrary JSON that you want to save as the output of this workflow
})
```

```js
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import type { UnwrapWebhookEvent } from 'https://esm.sh/@mux/mux-node@12';
import { writeWorkflowOutput } from '../../../lib/workflow-output.ts'

async function requestModeration (playbackId: string) {
  // Do your moderation logic, make API calls to LLMs, etc.
  // return a JSON object you want to save as the Workflow output
  return {
    adult: 0.0,
    voilence: 0.0,
    suggestive: 0.2
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
  const playbackId = asset.playback_ids && asset.playback_ids[0] && asset.playback_ids[0].id;
  if (!playbackId) {
    console.log('No playbackId');
    return new Response('No playbackId provided', { status: 400 });
  }
  const resp = await requestModeration(playbackId);
  const complete = new Date();
  await writeWorkflowOutput({
    slug: 'content-moderation',
    version: '1',
    started_at: start,
    completed_at: complete,
    mux_asset_id: asset.id,
    output_data: resp
  });
});
```

# TODO

- [ ] Run linting in CI
- [ ] Add tests
- [ ] Fix lint warnings around using TS `any`
- [ ] Fix lint warnings around using TS `any`
- [ ] Add webhook signature verification
- [ ] Figure out a backstory
