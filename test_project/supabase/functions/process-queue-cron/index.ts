import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { processQueueCron } from 'npm:@mux/supabase@0.0.12'

Deno.serve(async (req) => {
  await processQueueCron(req);
  return new Response(JSON.stringify({ message: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
