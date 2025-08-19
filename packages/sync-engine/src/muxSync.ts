import { Mux } from '@mux/mux-node';
import { PostgresClient } from './database/postgres';
import { muxAssetsSchema } from './schemas/mux_assets';
import { muxLiveStreamsSchema } from './schemas/mux_live_streams';
import { muxUploadsSchema } from './schemas/mux_uploads';
import {
  MuxSyncConfig,
  Sync,
  SyncBackfill,
  SyncBackfillParams,
  Logger,
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
                return (response as any).data ?? (response as any);
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
              return (response as any).data ?? (response as any);
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
              return (response as any).data ?? (response as any);
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
          const staticRendition = event.data as any;
          await this.handleAssetStaticRenditionEvent(staticRendition);
          break;
        }

        // Simulcast targets
        //tiene el live_stream_id en el webhook
        // case 'video.live_stream.simulcast_target.created':
        // case 'video.live_stream.simulcast_target.idle':
        // case 'video.live_stream.simulcast_target.starting':
        // case 'video.live_stream.simulcast_target.broadcasting':
        // case 'video.live_stream.simulcast_target.errored':
        // case 'video.live_stream.simulcast_target.deleted':
        // case 'video.live_stream.simulcast_target.updated': {
        //   const liveStreamId = (event.data as any)?.live_stream_id as string | undefined
        //   if (liveStreamId) {
        //     try {
        //       const response = await this.mux.video.liveStreams.retrieve(liveStreamId)
        //       const liveStream = (response as any).data ?? (response as any)
        //       await this.upsertLiveStreams([liveStream])
        //     } catch (error) {
        //       this.logger.warn?.('Failed to fetch live stream for simulcast event', error)
        //     }
        //   }
        //   break
        // }

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

  private async upsertAssets(assets: Mux.Video.Assets.Asset[]): Promise<any[]> {
    const transformedAssets = assets.map((asset: any) => ({
      ...asset,
      mux_asset_id: asset.id,
      created_at: asset.created_at
        ? new Date(Number(asset.created_at) * 1000).toISOString()
        : null,
    }));

    return this.postgresClient.upsertMany(
      transformedAssets,
      'assets',
      muxAssetsSchema,
      { conflict: 'mux_asset_id' }
    );
  }

  private async genericSync<T>(
    resourceName: string,
    listFn: (params: any) => Promise<any>,
    upsertFn: (items: T[]) => Promise<any>
  ): Promise<Sync> {
    this.logger.info(`Starting Mux ${resourceName} sync...`);

    let nextCursor: string | undefined;
    let totalSynced = 0;
    let pageCount = 0;

    do {
      pageCount++;
      this.logger.info(`Fetching page ${pageCount} of Mux ${resourceName}...`);

      const listParams: Record<string, unknown> = { limit: 100 };
      if (nextCursor) listParams.cursor = nextCursor;

      const response = await listFn(listParams);
      const items = ((response as any).data ?? []) as T[];

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

      nextCursor =
        (response as any).body?.next_cursor ??
        (response as any).next_cursor ??
        undefined;
    } while (nextCursor);

    this.logger.info(
      `✅ Mux ${resourceName} sync completed! Total ${resourceName} synced: ${totalSynced}`
    );
    return { synced: totalSynced };
  }

  async syncMuxAssets(): Promise<Sync> {
    return this.genericSync<Mux.Video.Assets.Asset>(
      'assets',
      (params) => this.mux.video.assets.list(params),
      (assets) => this.upsertAssets(assets)
    );
  }

  private async upsertLiveStreams(
    liveStreams: Mux.Video.LiveStreams.LiveStream[]
  ): Promise<any[]> {
    return this.upsertWithAssetValidation(liveStreams, {
      assetIdField: 'active_asset_id',
      entityName: 'Live streams',
      transformFn: (ls: any, missingAssetIds: string[]) => ({
        ...ls,
        mux_live_stream_id: ls.id,
        active_asset_id: missingAssetIds.includes(ls.active_asset_id)
          ? null
          : ls.active_asset_id,
        created_at: ls.created_at
          ? new Date(Number(ls.created_at) * 1000).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      tableName: 'live_streams',
      schema: muxLiveStreamsSchema,
      conflictField: 'mux_live_stream_id',
    });
  }

  private async syncMuxLiveStreams(): Promise<Sync> {
    return this.genericSync<Mux.Video.LiveStreams.LiveStream>(
      'live streams',
      (params) => this.mux.video.liveStreams.list(params),
      (liveStreams) => this.upsertLiveStreams(liveStreams)
    );
  }

  private async syncMuxUploads(): Promise<Sync> {
    return this.genericSync<Mux.Video.Uploads.Upload>(
      'uploads',
      (params) => this.mux.video.uploads.list(params),
      (uploads) => this.upsertUploads(uploads)
    );
  }

  private async handleAssetUpdateEvent(
    assetId: string,
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
      const asset = (response as any).data ?? (response as any);
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
    const assetId = (track as any).asset_id;
    await this.handleAssetUpdateEvent(assetId, 'track');
  }

  private async handleAssetStaticRenditionEvent(
    staticRendition: any
  ): Promise<void> {
    const assetId = (staticRendition as any).asset_id;
    await this.handleAssetUpdateEvent(assetId, 'static_rendition');
  }

  private async upsertWithAssetValidation<T extends Record<string, any>>(
    items: T[],
    config: {
      assetIdField: string;
      entityName: string;
      transformFn: (item: T, missingAssetIds: string[]) => any;
      tableName: string;
      schema: any;
      conflictField: string;
    }
  ): Promise<any[]> {
    // Validate FK to assets: ensure referenced asset rows exist or nullify to avoid FK violation
    const assetIds = Array.from(
      new Set(
        items
          .map((item: any) => item[config.assetIdField])
          .filter(
            (it: unknown): it is string =>
              typeof it === 'string' && it.length > 0
          )
      )
    );

    let missing: string[] = [];
    if (assetIds.length) {
      missing = await this.postgresClient.findMissingEntries(
        'mux_asset_id',
        'assets',
        assetIds
      );

      if (missing.length) {
        // Try to fetch and upsert the missing assets from Mux API
        const fetchedAssets: Mux.Video.Assets.Asset[] = [];
        for (const id of missing) {
          try {
            const response = await this.mux.video.assets.retrieve(id);
            const asset = (response as any).data ?? (response as any);
            fetchedAssets.push(asset);
          } catch {
            this.logger.warn?.(
              `Failed fetching asset ${id} referenced by ${config.entityName}`
            );
          }
        }
        if (fetchedAssets.length) {
          await this.upsertAssets(fetchedAssets);
        }

        // Recompute missing after attempted backfill
        missing = await this.postgresClient.findMissingEntries(
          'mux_asset_id',
          'assets',
          assetIds
        );
      }
    }

    if (missing.length) {
      this.logger.warn?.(
        `${config.entityName} reference missing assets; nullifying ${config.assetIdField} for: ${missing.join(', ')}`
      );
    }

    const transformed = items.map((item: T) =>
      config.transformFn(item, missing)
    );

    return this.postgresClient.upsertMany(
      transformed,
      config.tableName,
      config.schema,
      {
        conflict: config.conflictField,
      }
    );
  }

  private async upsertUploads(
    uploads: Mux.Video.Uploads.Upload[]
  ): Promise<any[]> {
    return this.upsertWithAssetValidation(uploads, {
      assetIdField: 'asset_id',
      entityName: 'Uploads',
      transformFn: (upload: any, missingAssetIds: string[]) => ({
        ...upload,
        mux_upload_id: upload.id,
        asset_id: missingAssetIds.includes(upload.asset_id)
          ? null
          : upload.asset_id,
      }),
      tableName: 'uploads',
      schema: muxUploadsSchema,
      conflictField: 'mux_upload_id',
    });
  }

  private async deleteAsset(muxAssetId: string): Promise<boolean> {
    return await this.postgresClient.deleteByField(
      'assets',
      'mux_asset_id',
      muxAssetId
    );
  }

  private async deleteLiveStream(muxLiveStreamId: string): Promise<boolean> {
    return await this.postgresClient.deleteByField(
      'live_streams',
      'mux_live_stream_id',
      muxLiveStreamId
    );
  }
}
