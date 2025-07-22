import Mux from '@mux/mux-node';

const mux = new Mux({
  webhookSecret: process.env.MUX_WEBHOOK_SECRET,
});

export async function handleMuxWebhook(req: Request): Promise<void> {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());
    
    const event = mux.webhooks.unwrap(body, headers);
    
    console.log('Received Mux webhook:', JSON.stringify(event, null, 2));

    switch (event.type) {
      case 'video.asset.ready':
        console.log('Video asset is ready:', {
          assetId: event.data.id,
          status: event.data.status,
          duration: event.data.duration,
          aspectRatio: event.data.aspect_ratio,
          maxStoredResolution: event.data.max_stored_resolution,
          createdAt: event.created_at
        });
        break;
      
      default:
        console.log('Unhandled Mux webhook event type:', event.type);
        break;
    }
  } catch (error) {
    console.error('Failed to process Mux webhook:', error);
    throw error;
  }
}
