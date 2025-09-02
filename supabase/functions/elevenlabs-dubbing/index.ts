// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("ElevenLabs Dubbing Function loaded")

/*
 * Available ElevenLabs Dubbing Languages:
 *
 * en - English        zh - Chinese        es - Spanish        hi - Hindi
 * pt - Portuguese     fr - French         de - German         ja - Japanese
 * ar - Arabic         ru - Russian        ko - Korean         id - Indonesian
 * it - Italian        nl - Dutch          tr - Turkish        pl - Polish
 * sv - Swedish        fil - Filipino      ms - Malay          ro - Romanian
 * uk - Ukrainian      el - Greek          cs - Czech          da - Danish
 * fi - Finnish        bg - Bulgarian      hr - Croatian       sk - Slovak
 * ta - Tamil
 */

// Configure target languages for dubbing - modify this array as needed
// FYI: more languages = more usage = longer job = higher cost
const TARGET_LANGUAGES = ['es'];

// Local development tunnel URL (set this when running locally with ngrok)
// Example: 'https://abc123.ngrok.io' - leave empty string for production
const LOCAL_TUNNEL_URL = 'https://be497ffcdb00.ngrok-free.app';

Deno.serve(async (req) => {
  try {
    const webhookData = await req.json();
    console.log('Received webhook:', webhookData);

    // Use configured target languages
    console.log('Target languages:', TARGET_LANGUAGES);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!


    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if running in development (localhost or local supabase)
    const isDevelopment = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1') ||
                         Deno.env.get('SUPABASE_ENVIRONMENT') === 'local'

    console.log('Environment:', isDevelopment ? 'development' : 'production');

    // Check if dubbing already exists or is in progress for this asset
    const assetId = webhookData.data.asset_id;
    console.log('Checking existing dubbings for asset:', assetId);

    const { data: existingDubbings, error: checkError } = await supabase
      .from('dubbings')
      .select('*')
      .eq('mux_asset_id', assetId)
      .in('target_language', TARGET_LANGUAGES);

    if (checkError) {
      console.error('Error checking existing dubbings:', checkError);
      throw new Error(`Failed to check existing dubbings: ${checkError.message}`);
    }

    // Filter out completed successful dubbings and failed ones that should be retried
    const pendingLanguages = TARGET_LANGUAGES.filter(lang => {
      const existing = existingDubbings?.find(d => d.target_language === lang);
      if (!existing) return true; // Language not attempted yet

      // Skip if already successfully completed
      if (existing.status === 'dubbed') {
        console.log(`Dubbing already completed for ${lang}, skipping`);
        return false;
      }

      // Skip if currently processing (within last hour to avoid stuck jobs)
      if (existing.status === 'processing') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (new Date(existing.updated_at) > oneHourAgo) {
          console.log(`Dubbing in progress for ${lang}, skipping`);
          return false;
        }
        console.log(`Dubbing stuck for ${lang}, will retry`);
        return true;
      }

      // Retry failed or timeout jobs
      console.log(`Will retry dubbing for ${lang} (previous status: ${existing.status})`);
      return true;
    });

    if (pendingLanguages.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'All requested languages already completed or in progress',
          existing_dubbings: existingDubbings,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    console.log('Languages to process:', pendingLanguages);

    // Get environment variables
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxTokenSecret = Deno.env.get('MUX_TOKEN_SECRET');
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!muxTokenId || !muxTokenSecret || !elevenlabsApiKey) {
      throw new Error('Missing required environment variables');
    }

    const muxAuth = btoa(`${muxTokenId}:${muxTokenSecret}`);

    // 1. Get the playback id from the Mux asset
    console.log('Fetching Mux asset:', webhookData.data.asset_id);
    const muxResponse = await fetch(`https://api.mux.com/video/v1/assets/${webhookData.data.asset_id}`, {
      headers: {
        'Authorization': `Basic ${muxAuth}`,
      },
    });

    if (!muxResponse.ok) {
      throw new Error(`Failed to fetch Mux asset: ${muxResponse.statusText}`);
    }

    const muxAsset = await muxResponse.json();
    console.log('Got Mux asset:', muxAsset.data.id);

    if (!muxAsset.data.playback_ids || muxAsset.data.playback_ids.length === 0) {
      throw new Error('No playback IDs found for asset');
    }

    const playbackId = muxAsset.data.playback_ids[0].id;
    const sourceUrl = `https://stream.mux.com/${playbackId}/audio.m4a`;

    // 2. Submit dubbing jobs for each target language
    const dubbingJobs = [];

    for (const targetLang of pendingLanguages) {
      console.log(`Submitting dubbing job for language: ${targetLang}`);
      const formData = new FormData();
      formData.append('target_lang', targetLang);
      formData.append('source_lang', 'auto');
      formData.append('mode', 'automatic');
      formData.append('num_speakers', '0');
      formData.append('watermark', 'false');
      formData.append('name', `Dub for ${playbackId} (${targetLang})`);
      formData.append('source_url', sourceUrl)

      const elevenlabsResponse = await fetch('https://api.elevenlabs.io/v1/dubbing', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        },
        body: formData,
      });

      if (!elevenlabsResponse.ok) {
        throw new Error(`ElevenLabs API error for ${targetLang}: ${elevenlabsResponse.statusText}`);
      }

      const dubbingJob = await elevenlabsResponse.json();
      dubbingJobs.push({ ...dubbingJob, targetLang });
      console.log(`Created dubbing job for ${targetLang}:`, dubbingJob.dubbing_id);

      // Insert or update dubbing record in database
      const { error: insertError } = await supabase
        .from('dubbings')
        .upsert({
          mux_asset_id: assetId,
          target_language: targetLang,
          elevenlabs_job_id: dubbingJob.dubbing_id,
          status: 'processing',
        }, {
          onConflict: 'mux_asset_id,target_language'
        });

      if (insertError) {
        console.error(`Failed to insert dubbing record for ${targetLang}:`, insertError);
        // Continue with other languages instead of throwing
      } else {
        console.log(`Inserted dubbing record for ${targetLang}`);
      }
    }

    // 3. Poll for all job completions
    console.log(`Polling for ${dubbingJobs.length} job(s) completion`);
    const completedJobs = [];
    const maxAttempts = 30; // 5 minutes max wait time per job

    for (const job of dubbingJobs) {
      let attempts = 0;
      let jobStatus;

      console.log(`Polling job ${job.dubbing_id} for language ${job.targetLang}`);

      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`https://api.elevenlabs.io/v1/dubbing/${job.dubbing_id}`, {
          headers: {
            'xi-api-key': elevenlabsApiKey,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to check dubbing status for ${job.targetLang}: ${statusResponse.statusText}`);
        }

        jobStatus = await statusResponse.json();
        console.log(`Job ${job.dubbing_id} (${job.targetLang}) status:`, jobStatus.status);

        if (jobStatus.status === 'dubbed') {
          console.log(`Dubbing completed successfully for ${job.targetLang}`);
          completedJobs.push({ ...job, jobStatus });

          // Update database status
          await supabase
            .from('dubbings')
            .update({ status: 'dubbed' })
            .eq('elevenlabs_job_id', job.dubbing_id);

          break;
        } else if (jobStatus.status === 'failed') {
          console.error(`Dubbing job failed for ${job.targetLang}`);

          // Update database status with failure
          await supabase
            .from('dubbings')
            .update({
              status: 'failed',
              error_message: 'ElevenLabs dubbing job failed'
            })
            .eq('elevenlabs_job_id', job.dubbing_id);

          // Continue with other jobs instead of throwing
          break;
        }

        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
      }

      if (attempts >= maxAttempts && jobStatus?.status !== 'dubbed') {
        console.error(`Dubbing job timed out for ${job.targetLang}`);

        // Update database status with timeout
        await supabase
          .from('dubbings')
          .update({
            status: 'timeout',
            error_message: 'Dubbing job timed out after 5 minutes'
          })
          .eq('elevenlabs_job_id', job.dubbing_id);

        // Continue with other jobs instead of throwing
      }
    }

    if (completedJobs.length === 0) {
      throw new Error('All dubbing jobs failed or timed out');
    }

    // 4. Process each completed job - download and save to Supabase, create Mux tracks
    const processedTracks = [];

    for (const job of completedJobs) {
      const { targetLang, dubbing_id, jobStatus } = job;

      try {
        console.log(`Processing completed job for ${targetLang}`);

        // Download dubbed audio
        const audioUrl = `https://api.elevenlabs.io/v1/dubbing/${dubbing_id}/audio/${targetLang}`;
        const dubbedAudioResponse = await fetch(audioUrl, {
          headers: {
            'xi-api-key': elevenlabsApiKey,
          },
        });

        if (!dubbedAudioResponse.ok) {
          console.error(`Failed to download dubbed audio for ${targetLang}: ${dubbedAudioResponse.statusText}`);
          continue;
        }

        const dubbedAudioBlob = await dubbedAudioResponse.blob();
        const fileName = `dubbed-audio/${muxAsset.data.id}-${targetLang}.mp3`;

        // Upload to Supabase storage
        console.log(`Uploading ${targetLang} audio to Supabase storage`);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dubbing')
          .upload(fileName, dubbedAudioBlob, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Failed to upload ${targetLang} to storage: ${uploadError.message}`);
          continue;
        }

        // Create signed URL (expires in 1 hour)
        const expiresIn = 60 * 60; // 1 hour in seconds
        const { data: urlData, error: urlError } = await supabase.storage
          .from('dubbing')
          .createSignedUrl(fileName, expiresIn);

        if (urlError) {
          console.error(`Failed to create signed URL for ${targetLang}:`, urlError);
          continue;
        }

        let supabaseFileURL = urlData.signedUrl;

        // Use tunnel URL in development if configured
        if ((isDevelopment || LOCAL_TUNNEL_URL) && LOCAL_TUNNEL_URL) {
          // Replace the supabase URL with the tunnel URL for signed URLs
          const urlObj = new URL(supabaseFileURL);
          supabaseFileURL = `${LOCAL_TUNNEL_URL}${urlObj.pathname}${urlObj.search}`;
          console.log(`Using tunnel signed URL for ${targetLang}:`, supabaseFileURL);
        } else {
          console.log(`Using signed URL for ${targetLang}:`, supabaseFileURL);
        }

        // Create Mux audio track
        console.log(`Creating Mux audio track for ${targetLang}`);
        const trackResponse = await fetch(`https://api.mux.com/video/v1/assets/${muxAsset.data.id}/tracks`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${muxAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'audio',
            url: supabaseFileURL,
            language_code: targetLang,
            passthrough: 'Dubbed by Elevenlabs',
          }),
        });

        if (!trackResponse.ok) {
          console.error(`Failed to create Mux audio track for ${targetLang}: ${trackResponse.statusText}`);
          continue;
        }

        const trackData = await trackResponse.json();
        console.log(`Created audio track for ${targetLang}:`, trackData.data.id);

        // Update database with final URLs and track ID
        const { error: finalUpdateError } = await supabase
          .from('dubbings')
          .update({
            audio_url: supabaseFileURL,
            mux_track_id: trackData.data.id,
            status: 'dubbed' // Ensure final status is set
          })
          .eq('elevenlabs_job_id', dubbing_id);

        if (finalUpdateError) {
          console.error(`Failed to update dubbing record with final data for ${targetLang}:`, finalUpdateError);
        } else {
          console.log(`Updated dubbing record with final data for ${targetLang}`);
        }

        processedTracks.push({
          language: targetLang,
          dubbing_id: dubbing_id,
          audio_track_id: trackData.data.id,
          audio_url: supabaseFileURL,
        });

      } catch (error) {
        console.error(`Error processing ${targetLang} dubbing:`, error.message);

        // Update database with processing error
        await supabase
          .from('dubbings')
          .update({
            status: 'failed',
            error_message: `Processing error: ${error.message}`
          })
          .eq('elevenlabs_job_id', dubbing_id);

        // Continue with other languages
      }
    }

    if (processedTracks.length === 0) {
      throw new Error('Failed to process any dubbing jobs successfully');
    }

    return new Response(
      JSON.stringify({
        message: `Dubbing completed successfully for ${processedTracks.length} language(s)`,
        total_jobs: dubbingJobs.length,
        successful_jobs: processedTracks.length,
        processed_tracks: processedTracks,
      }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error('Error in dubbing function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
})
