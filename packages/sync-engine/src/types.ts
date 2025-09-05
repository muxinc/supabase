export type Logger = Pick<
  globalThis.Console,
  'info' | 'error' | 'warn' | 'debug'
>;

export type MuxSyncConfig = {
  /** Postgres database URL including authentication */
  databaseUrl: string;

  /** Mux token ID used to authenticate requests to the Mux API. */
  muxTokenId: string;

  /** Mux token secret used to authenticate requests to the Mux API. */
  muxTokenSecret: string;

  /** Mux webhook secret used to verify the signature of webhook events. */
  muxWebhookSecret: string;

  /**
   * If true, the sync engine will backfill related entities, i.e. when a Upload webhook comes in, it ensures that the asset is present and synced.
   * This ensures foreign key integrity, but comes at the cost of additional queries to the database (and added latency for Mux calls if the entity is actually missing).
   */
  backfillRelatedEntities?: boolean;

  /**
   * If true, the webhook data is not used and instead the webhook is just a trigger to fetch the entity from Mux again. This ensures that a race condition with failed webhooks can never accidentally overwrite the data with an older state.
   *
   * Default: false
   */
  revalidateEntityViaMuxApi?: boolean;

  maxPostgresConnections?: number;

  /** Optional logger. If not provided, `console` will be used. */
  logger?: Logger;
};

export type SyncObject =
  | 'all'
  | 'mux_assets'
  | 'mux_live_streams'
  | 'mux_uploads';

export interface Sync {
  synced: number;
}

export interface SyncBackfill {
  muxAssets?: Sync;
  muxLiveStreams?: Sync;
  muxUploads?: Sync;
}

export interface SyncBackfillParams {
  object?: SyncObject;
}

// Types for Mux API list responses that wrap data
export interface MuxListResponse<T> {
  data: T[];
  next_cursor?: string;
}

// Types for webhook event data structures
export interface SimulcastTargetData {
  live_stream_id?: string;
  id?: string;
  [key: string]: unknown;
}

export interface StaticRenditionData {
  asset_id?: string;
  id?: string;
  [key: string]: unknown;
}

export interface TrackData extends Record<string, unknown> {
  asset_id?: string;
  id?: string;
}

// Transform function type
export type TransformFunction<T, R = Record<string, unknown>> = (
  entity: T
) => R;

// Generic upsert result
export interface UpsertResult {
  id: string;
  [key: string]: unknown;
}

export type EntitySchema = import('./schemas/types').EntitySchema;
