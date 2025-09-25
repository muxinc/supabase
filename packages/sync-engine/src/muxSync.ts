import { Mux } from '@mux/mux-node';
import { PostgresClient } from './database/postgres';
import { muxAssetsSchema } from './schemas/mux_assets';
import { muxLiveStreamsSchema } from './schemas/mux_live_streams';
import { muxUploadsSchema } from './schemas/mux_uploads';
import { muxWebhookEventsSchema } from './schemas/mux_webhook_events';
import {
  MuxSyncConfig,
  Sync,
  SyncBackfill,
  SyncBackfillParams,
  Logger,
  SimulcastTargetData,
  StaticRenditionData,
  TrackData,
  EntitySchema,
} from './types';
import { HeadersLike } from '@mux/mux-node/core';

const DEFAULT_SCHEMA = 'mux';

export class MuxSync {
  mux: Mux;
  postgresClient: PostgresClient;
  private logger: Logger;

  constructor(private config: MuxSyncConfig) {
    this.logger = config.logger || console;
    this.mux = new Mux({
      tokenId: config.muxTokenId,
      tokenSecret: config.muxTokenSecret,
      webhookSecret: config.muxWebhookSecret,
    });

    this.logger.info('MuxSync initialized');

    this.postgresClient = new PostgresClient({
      databaseUrl: config.databaseUrl,
      schema: DEFAULT_SCHEMA,
      maxConnections: config.maxPostgresConnections,
    });
  }

  async processWebhook(payload: string, headers: HeadersLike) {
    const event = this.mux.webhooks.unwrap(payload, headers);
    this.logger.info(`Received webhook ${event.id}: ${event.type}`);

    // Store the webhook event and payload
    await this.upsertWebhookEvent(event, headers);

    const eventType = event.type as string;

    try {
      switch (eventType) {
        // Assets
        case 'video.asset.created':
        case 'video.asset.ready':
        case 'video.asset.updated':
        case 'video.asset.errored':
        case 'video.asset.live_stream_completed':
        case 'video.asset.static_renditions.ready':
        case 'video.asset.static_renditions.preparing':
        case 'video.asset.static_renditions.deleted':
        case 'video.asset.static_renditions.errored':
        case 'video.asset.master.ready':
        case 'video.asset.master.preparing':
        case 'video.asset.master.deleted':
        case 'video.asset.warning':
        case 'video.asset.non_standard_input_detected':
        case 'video.asset.master.errored': {
          const asset: Mux.Video.Assets.Asset =
            await this.fetchOrUseWebhookData(
              event.data as Mux.Video.Assets.Asset,
              async (id) => {
                const response = await this.mux.video.assets.retrieve(id);
                return (
                  (response as { data?: Mux.Video.Assets.Asset }).data ??
                  (response as Mux.Video.Assets.Asset)
                );
              }
            );
          await this.upsertAssets([asset]);
          break;
        }

        // Asset deletion
        case 'video.asset.deleted': {
          const assetData = event.data as Mux.Video.Assets.Asset;
          if (assetData.id) {
            await this.deleteAsset(assetData.id);
          } else {
            this.logger.warn(
              'Asset deletion event received but no asset id found'
            );
          }
          break;
        }
        // Uploads
        case 'video.upload.created':
        case 'video.upload.asset_created':
        case 'video.upload.cancelled':
        case 'video.upload.errored': {
          const upload = await this.fetchOrUseWebhookData(
            event.data as Mux.Video.Uploads.Upload,
            async (id) => {
              const response = await this.mux.video.uploads.retrieve(id);
              return (
                (response as { data?: Mux.Video.Uploads.Upload }).data ??
                (response as Mux.Video.Uploads.Upload)
              );
            }
          );
          await this.upsertUploads([upload]);
          break;
        }

        // Tracks
        case 'video.asset.track.created':
        case 'video.asset.track.ready':
        case 'video.asset.track.errored':
        case 'video.asset.track.deleted': {
          const track = event.data as Mux.Video.Assets.Track;
          await this.handleAssetTrackEvent(track);
          break;
        }

        // Live streams
        case 'video.live_stream.warning':
        case 'video.live_stream.created':
        case 'video.live_stream.connected':
        case 'video.live_stream.recording':
        case 'video.live_stream.active':
        case 'video.live_stream.disconnected':
        case 'video.live_stream.idle':
        case 'video.live_stream.updated':
        case 'video.live_stream.enabled':
        case 'video.live_stream.disabled': {
          const liveStream = await this.fetchOrUseWebhookData(
            event.data as Mux.Video.LiveStreams.LiveStream,
            async (id) => {
              const response = await this.mux.video.liveStreams.retrieve(id);
              return (
                (response as { data?: Mux.Video.LiveStreams.LiveStream })
                  .data ?? (response as Mux.Video.LiveStreams.LiveStream)
              );
            }
          );
          await this.upsertLiveStreams([liveStream]);
          break;
        }

        // Live stream deletion
        case 'video.live_stream.deleted': {
          const liveStreamData = event.data as Mux.Video.LiveStreams.LiveStream;
          if (liveStreamData.id) {
            await this.deleteLiveStream(liveStreamData.id);
          } else {
            this.logger.warn(
              'Live stream deletion event received but no live stream id found'
            );
          }
          break;
        }

        // Static rendition
        case 'video.asset.static_rendition.created':
        case 'video.asset.static_rendition.ready':
        case 'video.asset.static_rendition.errored':
        case 'video.asset.static_rendition.skipped':
        case 'video.asset.static_rendition.deleted': {
          const staticRendition = event.data as StaticRenditionData;
          await this.handleAssetStaticRenditionEvent(staticRendition);
          break;
        }

        // Simulcast targets
        case 'video.live_stream.simulcast_target.created':
        case 'video.live_stream.simulcast_target.idle':
        case 'video.live_stream.simulcast_target.starting':
        case 'video.live_stream.simulcast_target.broadcasting':
        case 'video.live_stream.simulcast_target.errored':
        case 'video.live_stream.simulcast_target.deleted':
        case 'video.live_stream.simulcast_target.updated': {
          const simulcastTargetData = event.data as SimulcastTargetData;
          await this.handleLiveStreamSimulcastTargetEvent(simulcastTargetData);
          break;
        }

        default:
          this.logger.warn('Unhandled webhook event', event.type);
          break;
      }
      this.logger.info(`Successfully processed webhook ${event.type}`);
    } catch (error) {
      this.logger.error(
        error as Error,
        `Error processing webhook ${event.type}`
      );
      throw error;
    }
  }

  async syncBackfill(params?: SyncBackfillParams): Promise<SyncBackfill> {
    const { object } = params ?? {};
    let muxAssets, muxLiveStreams, muxUploads;

    switch (object) {
      case 'all':
        muxAssets = await this.syncMuxAssets();
        [muxLiveStreams, muxUploads] = await Promise.all([
          this.syncMuxLiveStreams(),
          this.syncMuxUploads(),
        ]);
        break;
      case 'mux_assets':
        muxAssets = await this.syncMuxAssets();
        break;
      case 'mux_live_streams':
        muxLiveStreams = await this.syncMuxLiveStreams();
        break;
      case 'mux_uploads':
        muxUploads = await this.syncMuxUploads();
        break;
      default:
        break;
    }

    return {
      muxAssets,
      muxLiveStreams,
      muxUploads,
    };
  }

  private async fetchOrUseWebhookData<T extends { id?: string }>(
    entity: T,
    fetchFn: (id: string) => Promise<T>
  ): Promise<T> {
    if (!entity.id) return entity;

    if (this.config.revalidateEntityViaMuxApi) {
      return fetchFn(entity.id);
    }

    return entity;
  }

  private async upsertAssets(
    assets: Mux.Video.Assets.Asset[]
  ): Promise<unknown[]> {
    const transformedAssets = assets.map((asset) => ({
      ...asset,
      duration_seconds: asset.duration,
      created_at: asset.created_at
        ? new Date(Number(asset.created_at) * 1000).toISOString()
        : null,
    }));

    return this.postgresClient.upsertMany(
      transformedAssets,
      'assets',
      muxAssetsSchema,
      { conflict: 'id' }
    );
  }

  private async genericSync<T>(
    resourceName: string,
    listFn: (params: Record<string, unknown>) => AsyncIterable<T>,
    upsertFn: (items: T[]) => Promise<unknown[]>
  ): Promise<Sync> {
    this.logger.info(`Starting Mux ${resourceName} sync...`);

    let totalSynced = 0;
    let batchCount = 0;
    let currentBatch: T[] = [];
    const batchSize = 100;

    try {
      // Use the SDK's blessed auto-pagination
      for await (const item of listFn({ limit: 100 })) {
        currentBatch.push(item);

        // Process in batches to match the original behavior
        if (currentBatch.length >= batchSize) {
          batchCount++;
          this.logger.info(
            `Processing ${currentBatch.length} ${resourceName} from batch ${batchCount}...`
          );
          await upsertFn(currentBatch);
          totalSynced += currentBatch.length;
          this.logger.info(
            `✓ Batch ${batchCount} completed. Total ${resourceName} synced so far: ${totalSynced}`
          );
          currentBatch = [];
        }
      }

      // Process any remaining items in the final batch
      if (currentBatch.length > 0) {
        batchCount++;
        this.logger.info(
          `Processing ${currentBatch.length} ${resourceName} from final batch ${batchCount}...`
        );
        await upsertFn(currentBatch);
        totalSynced += currentBatch.length;
        this.logger.info(
          `✓ Final batch ${batchCount} completed. Total ${resourceName} synced so far: ${totalSynced}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error during ${resourceName} sync with auto-pagination:`,
        error
      );
      throw error;
    }

    if (totalSynced === 0) {
      this.logger.info(`No ${resourceName} found`);
    }

    this.logger.info(
      `✅ Mux ${resourceName} sync completed! Total ${resourceName} synced: ${totalSynced}`
    );
    return { synced: totalSynced };
  }

  private async genericSyncWithoutCursor<T>(
    resourceName: string,
    listFn: (params: Record<string, unknown>) => Promise<any>,
    upsertFn: (items: T[]) => Promise<unknown[]>
  ): Promise<Sync> {
    this.logger.info(`Starting Mux ${resourceName} sync (without cursor)...`);

    let totalSynced = 0;
    let pageCount = 0;

    try {
      // Start with the first page
      let page = await listFn({ limit: 100 });

      while (true) {
        pageCount++;
        const items = page.getPaginatedItems() as T[];

        if (items.length) {
          this.logger.info(
            `Processing ${items.length} ${resourceName} from page ${pageCount}...`
          );
          await upsertFn(items);
          totalSynced += items.length;
          this.logger.info(
            `✓ Page ${pageCount} completed. Total ${resourceName} synced so far: ${totalSynced}`
          );
        } else {
          this.logger.info(`No ${resourceName} found on page ${pageCount}`);
        }

        // Move to next page if available
        if (page.hasNextPage()) {
          page = await page.getNextPage();
        } else {
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Error during ${resourceName} sync without cursor:`,
        error
      );
      throw error;
    }

    this.logger.info(
      `✅ Mux ${resourceName} sync completed! Total ${resourceName} synced: ${totalSynced}`
    );
    return { synced: totalSynced };
  }

  private async syncMuxAssets(assetIds?: string[]): Promise<Sync> {
    if (assetIds?.length) {
      const result: Sync = { synced: 0 };
      const missing = await this.postgresClient.findMissingEntries(
        'id',
        'assets',
        assetIds
      );
      if (missing.length) {
        const fetchedAssets: Mux.Video.Assets.Asset[] = [];
        for (const id of missing) {
          try {
            const asset = await this.mux.video.assets.retrieve(id);
            fetchedAssets.push(asset);
          } catch {
            this.logger.warn?.(`Failed fetching asset ${id}`);
          }
        }
        if (fetchedAssets.length) {
          const rows = await this.upsertAssets(fetchedAssets);
          result.synced = rows.length;
        }
      }
      return result;
    }

    return this.genericSync<Mux.Video.Assets.Asset>(
      'assets',
      (params) => this.mux.video.assets.list(params),
      (assets) => this.upsertAssets(assets)
    );
  }

  private async upsertEntitiesWithRelatedAssets<
    T,
    R extends Record<string, unknown> = Record<string, unknown>,
  >(
    entities: T[],
    tableName: string,
    schema: EntitySchema,
    config: {
      assetIds?: string[];
      transformEntity: (entity: T) => R;
    }
  ): Promise<unknown[]> {
    if (this.config.backfillRelatedEntities && config.assetIds?.length) {
      await this.syncMuxAssets(config.assetIds);
    }

    const transformedEntities = entities.map(config.transformEntity);

    return this.postgresClient.upsertMany(
      transformedEntities,
      tableName,
      schema,
      {
        conflict: 'id',
      }
    );
  }

  private async upsertLiveStreams(
    liveStreams: Mux.Video.LiveStreams.LiveStream[]
  ): Promise<unknown[]> {
    // Extract asset IDs for backfill
    const assetIds = liveStreams
      .filter((ls) => ls.active_asset_id != null)
      .map((ls) => ls.active_asset_id!);

    return this.upsertEntitiesWithRelatedAssets(
      liveStreams,
      'live_streams',
      muxLiveStreamsSchema,
      {
        assetIds,
        transformEntity: (ls: Mux.Video.LiveStreams.LiveStream) => ({
          ...ls,
          created_at: ls.created_at
            ? new Date(Number(ls.created_at) * 1000).toISOString()
            : null,
          max_continuous_duration_seconds: ls.max_continuous_duration,
          reconnect_window_seconds: ls.reconnect_window,
        }),
      }
    );
  }

  private async upsertUploads(
    uploads: Mux.Video.Uploads.Upload[]
  ): Promise<unknown[]> {
    // Extract asset IDs for backfill
    const assetIds = uploads
      .filter((u) => u.asset_id != null)
      .map((u) => u.asset_id!);

    return this.upsertEntitiesWithRelatedAssets(
      uploads,
      'uploads',
      muxUploadsSchema,
      {
        assetIds,
        transformEntity: (u: Mux.Video.Uploads.Upload) => ({
          ...u,
          timeout_seconds: u.timeout,
        }),
      }
    );
  }

  private async syncMuxLiveStreams(): Promise<Sync> {
    return this.genericSync<Mux.Video.LiveStreams.LiveStream>(
      'live streams',
      (params) => this.mux.video.liveStreams.list(params),
      (liveStreams) => this.upsertLiveStreams(liveStreams)
    );
  }

  private async syncMuxUploads(): Promise<Sync> {
    return this.genericSyncWithoutCursor<Mux.Video.Uploads.Upload>(
      'uploads',
      (params) => this.mux.video.uploads.list(params),
      (uploads) => this.upsertUploads(uploads)
    );
  }

  private async handleAssetUpdateEvent(
    assetId: string | undefined,
    eventType: string
  ): Promise<void> {
    if (!assetId) {
      this.logger.warn?.(
        `${eventType} event received but no asset_id found in webhook data`
      );
      return;
    }

    try {
      const response = await this.mux.video.assets.retrieve(assetId);
      const asset =
        (response as { data?: Mux.Video.Assets.Asset }).data ??
        (response as Mux.Video.Assets.Asset);
      await this.upsertAssets([asset]);
    } catch (error) {
      this.logger.warn?.(
        `${eventType} event received but asset ${assetId} not found (likely deleted): ${error}`
      );
      return;
    }
  }

  private async handleAssetTrackEvent(
    track: Mux.Video.Assets.Track
  ): Promise<void> {
    const assetId = (track as TrackData).asset_id;
    await this.handleAssetUpdateEvent(assetId, 'track');
  }

  private async handleLiveStreamUpdateEvent(
    liveStreamId: string | undefined,
    eventType: string
  ): Promise<void> {
    if (!liveStreamId) {
      this.logger.warn?.(
        `${eventType} event received but no live_stream_id found in webhook data`
      );
      return;
    }

    try {
      const response = await this.mux.video.liveStreams.retrieve(liveStreamId);
      const liveStream =
        (response as { data?: Mux.Video.LiveStreams.LiveStream }).data ??
        (response as Mux.Video.LiveStreams.LiveStream);
      await this.upsertLiveStreams([liveStream]);
    } catch (error) {
      this.logger.warn?.(
        `${eventType} event received but live stream ${liveStreamId} not found (likely deleted): ${error}`
      );
      return;
    }
  }

  private async handleLiveStreamSimulcastTargetEvent(
    simulcastTargetData: SimulcastTargetData
  ): Promise<void> {
    const liveStreamId = simulcastTargetData?.live_stream_id;
    await this.handleLiveStreamUpdateEvent(liveStreamId, 'simulcast_target');
  }

  private async handleAssetStaticRenditionEvent(
    staticRendition: StaticRenditionData
  ): Promise<void> {
    const assetId = staticRendition.asset_id;
    await this.handleAssetUpdateEvent(assetId, 'static_rendition');
  }

  private async deleteAsset(muxAssetId: string): Promise<boolean> {
    return await this.postgresClient.deleteByField('assets', 'id', muxAssetId);
  }

  private async deleteLiveStream(muxLiveStreamId: string): Promise<boolean> {
    return await this.postgresClient.deleteByField(
      'live_streams',
      'id',
      muxLiveStreamId
    );
  }

  private async upsertWebhookEvent(
    event: Mux.Webhooks.UnwrapWebhookEvent,
    headers: HeadersLike
  ): Promise<void> {
    const transformedEvent = {
      ...event,
      created_at: event.created_at,
      attempts: event.attempts || [],
      environment: event.environment || {},
      object: event.object || {},
      raw_body: event.data,
      headers,
    };

    try {
      await this.postgresClient.upsertMany(
        [transformedEvent],
        'webhook_events',
        muxWebhookEventsSchema,
        { conflict: 'id' }
      );

      this.logger.info(`Stored webhook event ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to store webhook event ${event.id}:`, error);
      throw error;
    }
  }
}
