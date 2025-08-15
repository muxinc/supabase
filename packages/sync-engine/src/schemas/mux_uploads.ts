import type { EntitySchema } from './types'

export const muxUploadsSchema: EntitySchema = {
  properties: [
    'mux_upload_id',
    'status',
    'timeout',
    'asset_id',
    'cors_origin',
    'url',
    'error',
    'test'
  ],
} as const


