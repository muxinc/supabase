# Publish

- `@mux/sync-engine` is a dependency for `@mux/supabase`. If you have changes to sync-engine, those should be published first

**Publish `@mux/sync-engine`**

- First, `cd packages/sync-engine`
- Run `npm install`
- Run `npm run build`
- Publish `npm publish --access public`

**Publish `@mux/supabase`**

- First, `cd packages/cli`
- If there's a new version of `@mux/sync-engine`, update the `package.json`
- Run `npm install`
- Run `npm run build`
- Publish `npm publish --access public`
