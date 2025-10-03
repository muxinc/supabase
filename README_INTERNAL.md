# Publish

- `@mux/sync-engine` is a dependency for `@mux/supabase`. If you have changes to sync-engine, those should be published first

**Publish `@mux/sync-engine`**

- First, `cd packages/sync-engine`
- Bump version in `package.json`
- Run `npm install`
- Run `npm run build`
- Publish `npm publish --access public`
- If publishing on an alpha tag, run `npm publish --access public --tag alpha`

**Publish `@mux/supabase`**

- First, `cd packages/supabase`
- Bump version in `package.json`
- If there's a new version of `@mux/sync-engine`, update the `package.json`
- Run `npm install`
- Run `npm run build`
- Publish `npm publish --access public`
- If publishing on an alpha tag, run `npm publish --access public --tag alpha`
