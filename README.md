# @mux/supabase


`@mux/supabase` contains a CLI for integrating your Mux account with your Supabase account. Setting this up will:

1. Create a `mux` schema that contains tables for:
   - `assets` ([Assets](https://www.mux.com/docs/api-reference/video/assets))
   - `live_streams` ([Live Streams](https://www.mux.com/docs/api-reference/video/live-streams))
   - `uploads` ([Direct Uploads](https://www.mux.com/docs/api-reference/video/direct-uploads))
   - `events` (Webhook events)
2. Set up an edge function for receiving webhooks and keeping data in the `mux` schema up-to-date

View the [README for @mux/supabase](./packages/cli/README.md).

# @mux/sync-engine

If you want the same syncing behavior with your postgres database, and you're not using Supabase, then you can do that directly with the `@mux/sync-engine` package, which works with any postgres database:

View the [README for @mux/sync-engine](./packages/sync-engine/README.md).
