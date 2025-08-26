// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  console.log('Reading messages from workflow_messages queue using pgmq...');

  const { data: messages, error } = await supabase
    .schema('pgmq_public')
    .rpc('read', {
      queue_name: 'workflow_messages',
      n: 1,
    });

  if (error) {
    console.error('Error reading from test_test queue:', error);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log('No messages in test_test queue');
    return;
  }

  console.log(message);
});
