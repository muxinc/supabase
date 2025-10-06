import { MuxSync } from '@mux/sync-engine';
import { promptForDatabaseUrl, promptForMuxCredentials } from './utils';

export async function backfillCommand(): Promise<void> {
  const databaseUrl = await promptForDatabaseUrl();
  const { muxTokenId, muxTokenSecret } = await promptForMuxCredentials();
  const muxWebhookSecret = '';

  const muxSync = new MuxSync({
    databaseUrl,
    muxTokenId,
    muxTokenSecret,
    muxWebhookSecret,
  });

  // Backfill assets and live streams
  const [muxAssets, muxLiveStreams] = await Promise.all([
    muxSync.syncBackfill({ object: 'mux_assets' }),
    muxSync.syncBackfill({ object: 'mux_live_streams' }),
  ]);

  console.log(`Synced ${muxAssets.muxAssets?.synced} assets`);
  console.log(`Synced ${muxLiveStreams.muxLiveStreams?.synced} live streams`);
}
