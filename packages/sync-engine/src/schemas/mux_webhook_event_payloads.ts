import type { EntitySchema } from './types';

export const muxWebhookEventPayloadsSchema: EntitySchema = {
  properties: ['webhook_event_id', 'raw_body', 'headers'],
} as const;
