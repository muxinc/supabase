# ElevenLabs Dubbing Function

This Supabase Edge Function automatically creates dubbed audio tracks for Mux video assets using ElevenLabs' AI dubbing service.

## Overview

The function receives Mux webhook events and:
1. Fetches the video asset from Mux
2. Downloads the source audio
3. Submits dubbing jobs to ElevenLabs for configured target languages
4. Polls for completion status
5. Saves dubbed audio to Supabase Storage
6. Creates new audio tracks in the Mux asset
7. Tracks all progress in a PostgreSQL database

## How It Works

### Flow
1. **Webhook Trigger**: Mux sends webhook when asset is ready
2. **Duplicate Check**: Function checks database for existing dubbing jobs
3. **Asset Fetch**: Retrieves Mux asset details and playback URLs
4. **Audio Download**: Downloads source audio from Mux stream
5. **Dubbing Submission**: Submits jobs to ElevenLabs for each target language
6. **Status Polling**: Monitors job progress (5-minute timeout per job)
7. **File Processing**: Downloads completed audio and uploads to Supabase Storage
8. **Track Creation**: Creates audio tracks in Mux with signed URLs
9. **Database Updates**: Records final status, URLs, and track IDs

### Database Tracking
- Prevents duplicate dubbing jobs for the same asset/language
- Tracks job status: `pending` → `processing` → `dubbed`/`failed`/`timeout`
- Stores audio URLs, Mux track IDs, and error messages
- Supports automatic retry of failed jobs

## Configuration

### Target Languages
Edit the `TARGET_LANGUAGES` constant in `index.ts`:

```javascript
const TARGET_LANGUAGES = ['es', 'fr', 'de']; // Spanish, French, German
```

**Available Languages:**
- `en` - English, `zh` - Chinese, `es` - Spanish, `hi` - Hindi
- `pt` - Portuguese, `fr` - French, `de` - German, `ja` - Japanese
- `ar` - Arabic, `ru` - Russian, `ko` - Korean, `id` - Indonesian
- `it` - Italian, `nl` - Dutch, `tr` - Turkish, `pl` - Polish
- `sv` - Swedish, `fil` - Filipino, `ms` - Malay, `ro` - Romanian
- `uk` - Ukrainian, `el` - Greek, `cs` - Czech, `da` - Danish
- `fi` - Finnish, `bg` - Bulgarian, `hr` - Croatian, `sk` - Slovak
- `ta` - Tamil

### Local Development Tunnel
For local development with ngrok, update the `LOCAL_TUNNEL_URL` constant:

```javascript
const LOCAL_TUNNEL_URL = 'https://abc123.ngrok.io';
```

## Required Environment Variables

```bash
# Mux API Credentials
MUX_TOKEN_ID=your_mux_token_id
MUX_TOKEN_SECRET=your_mux_token_secret

# ElevenLabs API
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Supabase (automatically provided by Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Setup Steps

### 1. Database Schema
The function requires a `dubbings` table. Run the schema:

```bash
supabase db reset
```

This will apply `/supabase/schemas/dubbings.sql` which creates the tracking table.

### 2. Supabase Storage Bucket
Create a storage bucket named `dubbing`:

**Local Development:**
- Visit: http://127.0.0.1:54323/project/default/storage/buckets
- Create bucket: `dubbing`
- Set as public if needed

**Production:**
- Visit your Supabase dashboard → Storage
- Create bucket: `dubbing`

**Note:** Recreate the bucket after each `supabase db reset`

### 3. Mux Asset Configuration
Upload videos to Mux with audio-only static rendition enabled:

```json
{
  "playback_policies": ["public"],
  "max_resolution_tier": "1080p", 
  "video_quality": "basic",
  "static_renditions": [
    {
      "resolution": "audio-only"
    }
  ]
}
```

### 4. Webhook Setup
Configure Mux webhook to call this function on asset ready events.

## Important Considerations

### Cost Management
- **More languages = higher costs**: Each language creates a separate ElevenLabs job
- **Job duration**: Longer videos cost more and take longer to process
- **Rate limits**: ElevenLabs has API rate limits

### Performance
- **Parallel processing**: All languages processed simultaneously
- **Timeout protection**: 5-minute timeout per job prevents hanging
- **Retry logic**: Failed jobs can be retried automatically
- **Duplicate prevention**: Existing successful dubbings are skipped

### Security
- **Signed URLs**: Audio files use 1-hour signed URLs for secure access
- **Row-level security**: Database access controlled by RLS policies
- **Environment variables**: All credentials stored securely

### Local Development
- **ngrok required**: For local testing, use ngrok to expose Supabase storage
- **Environment detection**: Automatically detects local vs production
- **Tunnel URL**: Set `LOCAL_TUNNEL_URL` for local development

## Troubleshooting

### Common Issues
1. **"Missing required environment variables"**: Check all env vars are set
2. **"No playback IDs found"**: Ensure Mux asset has audio-only rendition
3. **"Failed to upload to storage"**: Check if `dubbing` bucket exists
4. **"Dubbing job failed"**: Check ElevenLabs API key and quotas

### Monitoring
- Check function logs for detailed progress information
- Query `dubbings` table for job status and history
- Monitor ElevenLabs dashboard for usage and quotas

### Database Queries
```sql
-- Check all dubbing jobs
SELECT * FROM dubbings ORDER BY created_at DESC;

-- Check failed jobs
SELECT * FROM dubbings WHERE status = 'failed';

-- Reset stuck jobs (older than 1 hour)
UPDATE dubbings SET status = 'failed', error_message = 'Reset stuck job'
WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '1 hour';
```

## Local Testing

```bash
# Start Supabase
supabase start

# Set up ngrok tunnel (if testing locally)
ngrok http 54321

# Update LOCAL_TUNNEL_URL in index.ts

# Test the function
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/elevenlabs-dubbing' \
  --header 'Authorization: Bearer your_anon_key' \
  --header 'Content-Type: application/json' \
  --data '{"data":{"asset_id":"your_mux_asset_id"}}'
```