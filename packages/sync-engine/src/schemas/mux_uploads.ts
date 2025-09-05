import type { EntitySchema } from './types';

export const muxUploadsSchema: EntitySchema = {
  properties: [
    'id',
    'status',
    'timeout_seconds',
    'asset_id',
    'cors_origin',
    'url',
    'error',
    'test',
  ],
} as const;
