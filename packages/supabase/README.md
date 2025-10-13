# @mux/supabase


`@mux/supabase` contains a CLI for integrating your Mux account with your Supabase account. Setting this up will:

1. Create a `mux` schema that contains tables for:
   - `assets` ([Assets](https://www.mux.com/docs/api-reference/video/assets))
   - `live_streams` ([Live Streams](https://www.mux.com/docs/api-reference/video/live-streams))
   - `uploads` ([Direct Uploads](https://www.mux.com/docs/api-reference/video/direct-uploads))
   - `events` (Webhook events)
2. Set up an edge function for receiving webhooks and keeping data in the `mux` schema up-to-date

## Getting started

**Dependencies**

Before setting this up, you should already have Supabase initialized in your project (your project should already have a `supabase` directory). If you have not already done this, run `npx supabase init` and see [this guide](https://supabase.com/docs/reference/cli/supabase-init).

**Local Setup**

You should run this after your supabase project is running with `npx supabase start`

Run init and follow the prompts. Then env vars should be in the `.env` file within the `supabase/functions` directory.

```bash
npx @mux/supabase init
```

This will:

- Create the `mux` schema and corresponding tables
- Create a function in `/supabase/functions/mux-webhook` which uses the `@mux/sync-engine` package to sync your data
- Prompt you to configure the `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`
- Expose the `mux` schema in the `[api]` section of `config.toml` to enable API requests to the Mux tables
  - If you want to make API requests and Supabase is already running, you need to restart the instance (`supabase stop` and `supabase start`) for the `config.toml` changes to take effect properly

**Running the Webhook locally**

`@mux/supabase` handles webhooks & keeping data updated in the `mux` schema.

To test the webhook locally, run:

```bash
npx supabase functions serve mux-webhook
```

This will run the Edge function locally on port 54321. To test with Mux, you need to expose the function to the internet. Use a service like ngrok for this.

Once done, get the public URL of your function (it should have a format like `https://d99d3b847eb8.ngrok-free.app/functions/v1/mux-webhook`) and set it in Mux following these steps: [Listen for webhooks](https://www.mux.com/docs/core/listen-for-webhooks).

After that, copy the webhook secret from Mux into `MUX_WEBHOOK_SECRET` in your .env file.

**Verify that it's working**

Go to your Mux dashboard, make sure you're in the correct environment and upload an asset. Then navigate to your local Supabase dashboard and you should see a row for the Asset in the `mux` schema `assets` table and the `id` should match the ID for the Asset in the Mux dashboard.

## Backfilling Existing Data

If you already have Mux assets, live streams, or uploads in your account, you can backfill them to your Supabase database using the CLI command:

```bash
npx @mux/supabase backfill
```

This will prompt you for the database URL where it will store the data and your Mux token and secret to sync the data.

If you prefer not to use the command, you can use the sync-engine directly:

```typescript
import { MuxSync } from '@mux/sync-engine';

const muxSync = new MuxSync({
  databaseUrl: 'your-supabase-database-url',
  muxTokenId: 'your-mux-token-id',
  muxTokenSecret: 'your-mux-token-secret',
  muxWebhookSecret: 'your-mux-webhook-secret',
});

// Backfill all data
const result = await muxSync.syncBackfill({ object: 'all' });
console.log(`Synced ${result.muxAssets?.synced} assets`);
console.log(`Synced ${result.muxLiveStreams?.synced} live streams`);
console.log(`Synced ${result.muxUploads?.synced} uploads`);

// Backfill specific object types
await muxSync.syncBackfill({ object: 'mux_assets' });
await muxSync.syncBackfill({ object: 'mux_live_streams' });
await muxSync.syncBackfill({ object: 'mux_uploads' });
```

## Core Concepts

Most Mux integrations require **saving data into a database**. The general flow to use Mux is:

- Videos can be uploaded directly to Mux with the [Direct Uploads API](https://www.mux.com/docs/guides/upload-files-directly)
- Videos can be uploaded with a URL pointing to a [publicly available video file](https://www.mux.com/docs/core/stream-video-files)
- Videos can be uploaded directly in the Mux dashboard

When a video (or audio file) is uploaded to Mux, it is [an Asset](https://www.mux.com/docs/api-reference/video/assets).

### Saving data associated with each video

When saving data into a database, typically the application would save information about the Mux Asset, like:

- Asset ID
- Playback ID
- Duration
- Aspect ratio

`@mux/supabase` will save all this data for you under the `mux` schema.

In addition to the information from Mux, the application also keeps track of things like:

- Which user uploaded the video
- Structural/organization things, like if the video is part of a series or related to other videos
- Video details like: description, summary, chapter markers, etc.
- Who has access to view the video

`@mux/supabase` does not save this kind of information, which is an application-level concern.

> Mux Assets DO have [fields for metadata](https://www.mux.com/docs/guides/add-metadata-to-your-videos): `title`, `creator_id` and `external_id` which will be saved under the `meta` JSON column in the `assets` table. Higher-level concepts (titles, chapters, permissions, etc.) are still considered application-level concerns.


## AI Workflows on Supabase

**This considered alpha right now and may change in future versions**

**Env setup**

You should have a local .env file in your project's root (same level as the `supabase` folder). This is **a different `.env` file** that what you have in `supabase/functions/.env`

- `SUPABASE_SERVICE_ROLE_KEY` Run `npx supabase status -o env` and look for `SERVICE_ROLE_KEY`
- `SUPABASE_URL` If you are developing locally this is: `http://supabase_kong_[name_of_supabase_project]:8000` (replace `[name_of_supabase_project]` with your actual project name)

You should only run this command after you have gone through the `@mux/supabase init` flow.

```
npx @mux/supabase init-workflows
```

If Supabase is running, you need to restart the instance (`supabase stop` and `supabase start`) for the `config.toml` changes to be applied correctly.

This will

- Set-up and run migrations to set up Supabase Queues & Supabase Cron. Both of these are required to run workflows
- Set up 2 secrets in `db.vault`. When migrations are run, the vault values are updated. These values need to be in the vault in order for the workflows to be called
- Create `supabase/functions/mux-webhook/mux.toml` file, where you will configure workflows. It also contains a example of use with content-moderation workflow.
- Add `static_files` in the `config.toml` for the `mux-webhook` function
- Expose the `pgmq_public` schema to enable inserting workflows into the queue


Define a workflow and when it should run:

**mux.toml**

```toml
# supabase/functions/mux-webhook/mux.toml
[workflows.content-moderation]
events = ["video.asset.ready"]
```

This means that when the `video.asset.ready` event fires, it will run your Supabase Edge Function called `content-moderation`

Create the Supabase Edge Function:

```
npx supabase functions new content-moderation
```

Open up supabase/functions/content-moderation/index.ts

```tsx
Deno.serve(async (req) => {
  try {
    const event = (await req.json()) as UnwrapWebhookEvent;
    const asset = event.data;
    if (!asset) {
      console.log('No asset in webhook');
      return new Response('No asset in webhook', { status: 500 });
    }

    console.log(`Running modeartion for asset: ${asset.id}`)
    // do your logic to make API calls, write data into your db, etc
    return new Response('Moderation complete', { status: 200 });
  } catch (error) {
    console.error("Error running content-moderation.ts:", error)
    return new Response(
      JSON.stringify({ error: "500" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
})
```

**Testing**

To test, run `supabase functions serve`, this will execute all created functions and then try creating an Asset and see that your content-moderation function runs.

To test this workflow, you can upload an Asset to Mux. This will trigger the `video.asset.ready` event when the Asset is ready for playback. You can do this either by creating an asset programmatically, or by uploading a video directly in the Mux dashboard.

**Troubleshooting**

If the Cron returns bearer token issues, make sure you have properly set the `mux_supabase_service_role_key` in the vault with the `SERVICE_ROLE_KEY` as mentioned in the Dependencies section.

You can find this in the Supabase dashboard under Integrations -> Vault and check what value is set for `mux_supabase_service_role_key`.

Note that vault values are loaded/modified when migrations are applied (`supabase migration up`).

In any case, if you want to test ignoring this, you can run the functions with JWT verification disabled using the command:

```bash
npx supabase functions serve --no-verify-jwt
```

## Production Deployment

To deploy to a Supabase project, you need to do the following:

**1. Modify the root .env with production values:**

- `SUPABASE_SERVICE_ROLE_KEY`: This is found in the Dashboard under Project Settings -> API Keys. Use the value of the service_role.
- `SUPABASE_URL`: This is the URL used to call edge functions, should have the format `https://[project_id].supabase.co`

**2. Run migrations:**

Once modified, run the migrations in your project with the command:
```bash
supabase db push
```
This will create the tables you had locally from the migrations folder.

**3. Expose Mux and pgmq_public schemas:**

To make API requests to Mux tables with the Service Role Key, you need to expose the Mux schema in Supabase.
If you initialized workflows, you also need to expose the pgmq_public schema.

You can do this in 2 ways:
- Manually in the Supabase Dashboard: Go to Project Settings -> Data API -> Exposed schemas. Add `mux` and `pgmq_public`.
- With the `supabase config push` command: This will take all the configuration from `config.toml` and apply it to your project.

**4. Set secrets for Edge Functions:**

You can do this in 2 ways:
- Set manually in the Dashboard
- Run the command:
```bash
supabase secrets set --env-file ./supabase/functions/.env
supabase secrets list
```

Make sure you have the .env file in the functions folder with your correct credentials.

Note: You can have a `.env.production` file to manage 2 environments if desired.

**5. Deploy functions:**

Once ready, deploy the functions with:
```bash
supabase functions deploy
```

**6. Set up the webhook:**

When everything is ready, we need to properly set the `MUX_WEBHOOK_SECRET`. Once the mux-webhook is deployed in Supabase, the URL will appear in Dashboard -> Edge Functions.

Similar to the "Running the Webhook locally" section, create the webhook in Mux with that URL and set the `MUX_WEBHOOK_SECRET` in the Supabase Dashboard with the new value.
