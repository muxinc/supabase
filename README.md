# @mux/supabase


`@mux/supabase` contains a CLI for integrating your Mux account with your Supabase account. Setting this up will:

1. Create a `mux` schema that contains tables for:
  - `assets` ([Assets](https://www.mux.com/docs/api-reference/video/assets))
  - `live_streams` ([Live Streams](https://www.mux.com/docs/api-reference/video/live-streams))
  - `uploads` ([Direct Uploads](https://www.mux.com/docs/api-reference/video/direct-uploads))
  - `events` (Webhook events)
2. Set up an edge function for receiving webhooks and keeping data in the `mux` schema up-to-date

## Getting started

Run init & follow the prompts. Be sure to set the required secrets in the Supabase dashboard under Edge Functions > Secrets

```
npx @mux/supabase@0.0.1 init
```

This will:

- Create the `mux` schema and corresponding tables
- Create a function in `/supabase/functions/mux-webhook` which uses the `@mux/sync-engine` package to sync your data

Deploy:

```
npx supabase functions deploy mux-webhook --prune
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
