import { createClient } from 'npm:@supabase/supabase-js@2';

// Single service client for both database operations and function invocations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Type definition for queue messages
interface QueueMessage {
  msg_id: bigint;
  read_ct: number;
  vt: string;
  enqueued_at: string;
  message: {
    workflow_name: string;
    event: any;
  };
}

/**
 * Process a message from the queue with automatic cleanup on success
 * @param message - The queue message to process
 * @param processor - The function to process the message payload
 */
async function processMessageWithCleanup(
  message: QueueMessage,
  processor: (payload: any) => Promise<void>
): Promise<void> {
  const msgId = message.msg_id;
  const payload = message.message;

  console.log(
    `Processing message ${msgId} read_ct=${message.read_ct} for workflow: ${payload.workflow_name}`
  );

  // Create the background task that processes and cleans up
  const backgroundTask = async () => {
    try {
      // Call the processor function
      await processor(payload);

      console.log(
        `Successfully processed message ${msgId}, deleting from queue`
      );

      // Delete the message from the queue on success
      const { error: deleteError } = await supabase
        .schema('pgmq_public')
        .rpc('delete', {
          queue_name: 'workflow_messages',
          msg_id: msgId,
        });

      if (deleteError) {
        console.error(`Failed to delete message ${msgId}:`, deleteError);
      } else {
        console.log(`Message ${msgId} deleted from queue`);
      }
    } catch (error) {
      console.error(`Error processing message ${msgId}:`, error);
      // Message stays in queue for retry since we don't delete on error
    }
  };

  // Use EdgeRuntime.waitUntil to process in background
  // This ensures the response can be sent immediately while processing continues
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(backgroundTask());
  } else {
    // Fallback for local development where EdgeRuntime might not be available
    console.log(`Message ${msgId} falling back to background processing`);
    await backgroundTask();
  }
}

/**
 * Invoke the actual workflow function via Supabase
 */
async function processWorkflowMessage(payload: any): Promise<void> {
  const { workflow_name, event } = payload;

  console.log(
    `Invoking workflow: ${workflow_name}`,
    JSON.stringify(event, null, 2)
  );

  try {
    // Use Supabase service client to invoke the Edge Function
    // supabase-js will attach Authorization: Bearer <service_key> for invoke
    const { data, error } = await supabase.functions.invoke(workflow_name, {
      body: event,
    });

    if (error) {
      throw new Error(`Workflow ${workflow_name} failed: ${error.message}`);
    }

    console.log(`Workflow ${workflow_name} completed successfully:`, data);
  } catch (error) {
    console.error(`Failed to invoke workflow ${workflow_name}:`, error);
    throw error; // Re-throw to prevent message deletion
  }
}

export async function processQueueCron(_req?: Request): Promise<void> {
  console.log('Reading messages from workflow_messages queue using pgmq...');

  const { data: messages, error } = await supabase
    .schema('pgmq_public')
    .rpc('read', {
      queue_name: 'workflow_messages',
      sleep_seconds: 0, // Don't wait if queue is empty
      n: 10, // Process up to 10 messages at once
    });

  if (error) {
    console.error('Error reading from workflow_messages queue:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!messages || messages.length === 0) {
    console.log('No messages in workflow_messages queue');
    return new Response(JSON.stringify({ message: 'No messages in queue' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`Found ${messages.length} messages to process`);

  // Process each message with the wrapper function
  for (const message of messages) {
    await processMessageWithCleanup(
      message as QueueMessage,
      processWorkflowMessage
    );
  }

  // Return immediately while background processing continues
  return new Response(
    JSON.stringify({
      message: `Processing ${messages.length} messages in background`,
      count: messages.length,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
