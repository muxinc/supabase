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

Before setting this up, you should already have Supabase initialized in your project (your project should already have a `supabase` directory). If you have not already done this, run `npx supabase init` and see [this guide](https://supabase.com/docs/reference/cli/supabase-init)

**Setup**

Run init & follow the prompts. Be sure to set the required secrets in the Supabase dashboard under Edge Functions > Secrets

```
npx @mux/supabase init
```

This will:

- Create the `mux` schema and corresponding tables
- Create a function in `/supabase/functions/mux-webhook` which uses the `@mux/sync-engine` package to sync your data
- Prompt you to configure the `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` in the Supabase dashboard

**Disable JWT auth on the webhook endpoint**

- Open `supabase/config.toml`
- Add this code to disable the jwt auth on the webhook endpoint (the Mux SDK when handling the webhook will [verify the signature](https://www.mux.com/docs/core/verify-webhook-signatures))

```toml
[functions.mux-webhook]
verify_jwt = false
```

Deploy the webhook:

```
npx supabase functions deploy mux-webhook --prune
```

After deploying the webhook function, set up the webhook in the Mux dashboard and add `MUX_WEBHOOK_SECRET` to the Supabase dashboard

**Verify that it's working**

Go to your Mux dashboard, make sure you're in the correct environment and upload an asset. Then navigate to your Supabase dashboard and you should see a row for the Asset in the `mux` schema `assets` table and the `id` should match the ID for the Asset in the Mux dashboard.

## Backfilling Existing Data

If you already have Mux assets, live streams, or uploads in your account, you can backfill them to your Supabase database:

```typescript
import { createMuxSync } from '@mux/sync-engine';

const muxSync = createMuxSync({
  databaseUrl: 'your-supabase-database-url',
  muxTokenId: 'your-mux-token-id',
  muxTokenSecret: 'your-mux-token-secret',
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
- Videos can be uploaded with a URL pointing to a [publicly avilable video file](https://www.mux.com/docs/core/stream-video-files)
- Videos can be uploaded directly in the Mux dashboard

When a video (or audio file) is uploaded to Mux, it is [an Asset](https://www.mux.com/docs/api-reference/video/assets)

**Saving data associated with each video**

When saving data into a database, typically the application would save information about the Mux Asset, like:
  - Asset ID
  - Playback ID
  - Duration
  - Aspect ratio

`@mux/supabase` will save all this data for you under the `mux` schema.

In addition to the information from Mux, the application also keeps track of things like:
  - Which user uploaded the video
  - Structural/organization things, like if the video is part of a series or related to other videos
  - Video title, description, summary, chapter markers, etc.
  - Who has access to view the video
  - etc.

`@mux/supabase` does not save this kind of inormation, which is an application-level concern.

**Webhooks**

The recommended way to keep data synced between Mux Assets and your database is to set up [Webhooks](https://www.mux.com/docs/core/listen-for-webhooks).

That way, when an Asset gets created, updated or deleted, your application server receives a webhook and can update the database accordingly.

`@mux/supabase` handles webhooks & keeping data updated in the `mux` schema.
