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

You should have a local .env file with

- `SUPABASE_DB_URL` If you're running supabase locally the value would be: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `SUPABASE_SERVICE_ROLE_KEY` After you run `supabase start` locally, this will be printed to the terminal as `service_role_key`, grab that and put it in .env
- `SUPABASE_URL` If you are developing locally this is: `http://127.0.0.1:54321`

**Setup**

Run init & follow the prompts. Be sure to set the required secrets in the Supabase dashboard under Edge Functions > Secrets.

```bash
npx @mux/supabase init
```

This will:

- Create the `mux` schema and corresponding tables
- Create a function in `/supabase/functions/mux-webhook` which uses the `@mux/sync-engine` package to sync your data
- Prompt you to configure the `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` in the Supabase dashboard

Deploy the webhook:

```bash
npx supabase functions deploy mux-webhook --prune
```

After deploying the webhook function, set up the webhook in the Mux dashboard and add `MUX_WEBHOOK_SECRET` to the Supabase dashboard.

**Verify that it's working**

Go to your Mux dashboard, make sure you're in the correct environment and upload an asset. Then navigate to your Supabase dashboard and you should see a row for the Asset in the `mux` schema `assets` table and the `id` should match the ID for the Asset in the Mux dashboard.

## Backfilling Existing Data

If you already have Mux assets, live streams, or uploads in your account, you can backfill them to your Supabase database:

```typescript
import { MuxSync } from '@mux/sync-engine';

const muxSync = MuxSync({
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

### Webhooks

The recommended way to keep data synced between Mux Assets and your database is to set up [Webhooks](https://www.mux.com/docs/core/listen-for-webhooks).

That way, when an Asset gets created, updated, or deleted, your application server receives a webhook and can update the database accordingly.

`@mux/supabase` handles webhooks & keeping data updated in the `mux` schema.

# AI Workflows on Supabase

**This is all very alpha right now. It will probably change**

You should only run this command after you have gone through the `@mux/supabase init` flow. Make sure you have all the `.env` vars listed above in dependencies

```
npx @mux/supabase init-workflows
```

This will

- Set-up and run migrations to set up Supabase Queues & Supabase Cron. Both of these are required to run workflows

Next, set up `mux.toml`

```
touch supabase/functions/mux-webhook/mux.toml
```

Define a workflow and when it should run:

**mux.toml**

```
[workflows.video-embeddings]
events = ["video.asset.track.ready"]
```

This means that when the `video.asset.track.ready` event fires, it will run your Supabase Edge Function called `video-embeddings`

Create the Supabase Edge Function:

```
npx supabase functions new video-embeddings
```

Open up supabase/functions/video-embeddings.ts

```tsx
Deno.serve(async (req) => {
  try {
    const event = (await req.json()) as UnwrapWebhookEvent;
    const track = event.data;
    if (!track) {
      console.log('No text track');
      return new Response('No text track in webhook', { status: 500 });
    }
    const trackId = track.id
    const assetId = track.asset_id

    console.log(`Creating embeddings for: ${assetId}`)
    // do your logic to make API calls, write data into your db, etc
    return new Response('No text track in webhook', { status: 500 });
  } catch (error) {
    console.error("Error running video-embedding.ts:", error)
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
