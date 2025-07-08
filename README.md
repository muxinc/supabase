# Supabase + Mux Integration

This project provides a complete integration between Supabase and Mux for video asset and live stream management.

## Features

- **Database Tables**: `mux_assets` and `mux_live_streams` tables to store Mux data
- **Sync Script**: Synchronizes assets and live streams from Mux API to Supabase
- **Webhook Handler**: Supabase Edge Function to handle Mux webhooks
- **Secure**: Client-side access blocked with RLS policies

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key
- `MUX_TOKEN_ID`: Your Mux token ID
- `MUX_TOKEN_SECRET`: Your Mux token secret
- `MUX_WEBHOOK_SECRET`: Your Mux webhook secret

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Database Migrations

```bash
npm run migrate
```

### 4. Deploy Edge Function

```bash
npm run functions:deploy
```

## Usage

### Sync Data from Mux

Run the sync script to pull all assets and live streams from Mux:

```bash
npm run sync
```

### Webhook Endpoint

The webhook endpoint will be available at:
```
https://your-project.supabase.co/functions/v1/mux-webhooks
```

Configure this URL in your Mux dashboard to receive real-time updates.

## Database Schema

### mux_assets Table

Stores Mux video assets with all relevant metadata including:
- Asset ID, status, duration
- Playback IDs, tracks, errors
- Video quality settings
- Live stream associations

### mux_live_streams Table

Stores Mux live streams with configuration:
- Stream keys and playback IDs
- Latency settings
- Asset associations
- Simulcast targets

## Security

Both tables have Row Level Security (RLS) enabled with policies that block all client-side access. Data can only be accessed server-side using the service role key.

## Development

Running supabase locally requires Docker Desktop

```bash
# Start local Supabase
npm run dev

# Serve functions locally
npm run functions:serve

# Reset database
npm run reset
```
