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
4. **Create functions env**: Generate `supabase/functions/.env` with placeholders for `SUPABASE_DB_URL`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`
5. **Run migrations**: Prompt for your database URL and create the necessary tables under the `mux` schema

### Prerequisites

Before running the init command, make sure you have:

- **Supabase CLI**: The Supabase CLI must be installed on your system
- **Supabase Database URL**: Your Supabase PostgreSQL connection string

**Note**: You'll need to manually configure the Supabase Edge Function secrets after initialization.

### Installing Supabase CLI

If you don't have Supabase CLI installed:

```bash
npm install -g supabase
```

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
   - SUPABASE_DB_URL: Your Supabase database URL
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
   - SUPABASE_DB_URL: Your Supabase database URL
   - MUX_TOKEN_ID: Your Mux token ID  
   - MUX_TOKEN_SECRET: Your Mux token secret
   - MUX_WEBHOOK_SECRET: A secret key for webhook verification
2. **Deploy the function**: `supabase functions deploy mux-webhook`
3. **Configure Mux webhook** to point to your Supabase function URL
4. **Test the integration** with a Mux event

## Development

To build the CLI locally:

```bash
cd packages/cli
npm install
npm run build
```

## License

MIT 