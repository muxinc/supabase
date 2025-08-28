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

# TODO

- [ ] Run linting in CI
- [ ] Add tests
- [ ] Fix lint warnings around using TS `any`
- [ ] Fix lint warnings around using TS `any`
- [ ] Add webhook signature verification
- [ ] Figure out a backfill story
