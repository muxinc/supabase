import type { EntitySchema } from './types';

export const muxWebhookEventsSchema: EntitySchema = {
  properties: [
    'id',
    'type',
    'created_at',
    'attempts',
    'environment',
    'object',
    'raw_body',
    'headers',
  ],
} as const;
