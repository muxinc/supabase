Make sure to upload your source video to Mux with an audio-only static rendition. Example settings:

```
{
  "playback_policies": [
    "public"
  ],
  "max_resolution_tier": "1080p",
  "video_quality": "basic",
  "static_renditions": [
    {
      "resolution": "audio-only"
    }
  ]
}
```

## Supabase Bucket

Visit the admin:

http://127.0.0.1:54323/project/default/storage/buckets

Create a bucket called `dubbing`

NOTE: you will have to recreate the bucket every time you run `supabase db reset`