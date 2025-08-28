# Mux Sync Supabase CLI

A CLI tool to easily initialize Mux Sync Engine with Supabase projects.

## Installation

```bash
npm install -g @r-delfino/mux-sync-supabase
```

## Usage

### Initialize with Supabase

```bash
npx @r-delfino/mux-sync-supabase init
```

This command will:

1. **Check project**: Ensure you're in a Supabase project (must contain a `supabase/` directory)
2. **Create Supabase Edge Function**: Generate `supabase/functions/mux-webhook/index.ts`
3. **Create Deno config**: Generate `supabase/functions/mux-webhook/deno.json` with the proper import mapping
4. **Create functions env**: Generate `supabase/functions/.env` with placeholders for `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`
5. **Run migrations**: Prompt for your database URL and create the necessary tables under the `mux` schema

### Prerequisites

Before running the init command, make sure you have:

- **Supabase Database URL**: Your Supabase PostgreSQL connection string

**Note**: You'll need to manually configure the Supabase Edge Function secrets after initialization.

### Example Output

```
🚀 Mux Sync Engine - Supabase Initialization
This will run migrations in your Supabase database and create a Supabase Edge Function example.

✅ Found Supabase directory
? Enter your Supabase database URL: postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
✅ Created supabase/functions/.env
✅ Created Supabase Edge Function at supabase/functions/mux-webhook/
✅ Database migrations completed successfully!

🎉 Setup completed successfully!

Next steps:
1. Configure Supabase Edge Function secrets:
   - MUX_TOKEN_ID: Your Mux token ID
   - MUX_TOKEN_SECRET: Your Mux token secret
   - MUX_WEBHOOK_SECRET: A secret key for webhook verification
2. Deploy the Edge Function: supabase functions deploy mux-webhook
3. Configure your Mux webhook to point to your Supabase function URL
4. Test the webhook with a Mux event

**💡 Tip**: You can set secrets in Supabase Dashboard > Settings > Edge Functions > Secrets
Or via CLI: supabase secrets set SUPABASE_DB_URL="your-url" MUX_TOKEN_ID="your-id" MUX_TOKEN_SECRET="your-secret" MUX_WEBHOOK_SECRET="your-webhook-secret"
```

## Generated Files

### Supabase Edge Function
The CLI creates a complete Supabase Edge Function at `supabase/functions/mux-webhook/` with:

- `index.ts`: The webhook handler function
- `deno.json`: Import mapping for the `@r-delfino/mux-sync-engine` npm package

## Next Steps

After running the init command:

1. **Configure Supabase Edge Function secrets**:
   - MUX_TOKEN_ID: Your Mux token ID  
   - MUX_TOKEN_SECRET: Your Mux token secret
   - MUX_WEBHOOK_SECRET: A secret key for webhook verification

2. **Disable JWT verification for mux-webhook** (required for proper function):
   
   **Option A - Using config.toml**:
   Add this to your `supabase/config.toml`:
   ```toml
   [functions.mux-webhook]
   verify_jwt = false
   ```
   
   **Option B - Using Supabase Dashboard** (function must be deployed first):
   - Go to Dashboard > Edge Functions
   - Select the `mux-webhook` function
   - Go to the Details tab
   - Disable "Verify JWT with legacy secret"

3. **Deploy the function**: `supabase functions deploy mux-webhook`
4. **Configure Mux webhook** to point to your Supabase function URL
5. **Test the integration** with a Mux event

## Development

### Building the CLI

To build the CLI locally:

```bash
cd packages/cli
npm install
npm run build
```

### Testing Locally

For local development and testing, you have two convenient installation scripts that allow you to test the CLI with different sync-engine configurations:

#### Option 1: Install with NPM Sync Engine

Use the published version of `@r-delfino/mux-sync-engine` from npm:

```bash
# From packages/cli directory
./install-local.sh
```

This script will:
- Uninstall any previous version of the CLI
- Build the current CLI code
- Install it globally using the npm version of the sync-engine
- Clean up any conflicting binaries

#### Option 2: Install with Local Sync Engine

Use your local development version of the sync-engine (recommended for full-stack development):

```bash
# From packages/cli directory
./install-local-with-local-engine.sh
```

This script will:
- Build the local sync-engine from `../sync-engine`
- Temporarily modify `package.json` to use `file:../sync-engine`
- Install dependencies and build the CLI
- Install the CLI globally with your local sync-engine changes
- Restore the original `package.json`

#### Testing the Installation

After running either script, you can test the CLI with:

```bash
mux-sync-supabase init
```

#### Uninstalling

To remove the globally installed CLI:

```bash
npm uninstall -g @r-delfino/mux-sync-supabase
```

### Development Workflow

1. Make changes to the CLI code in `src/`
2. Choose your testing approach:
   - Use `install-local.sh` if you only need to test CLI changes
   - Use `install-local-with-local-engine.sh` if you're also modifying the sync-engine
3. Test your changes with `mux-sync-supabase init`
4. Repeat as needed

## License

MIT
