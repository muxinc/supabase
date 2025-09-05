// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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

// Type definitions for workflow execution tracking
interface WorkflowExecution {
  id: string;
  message_id: bigint;
  workflow_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'shutdown_interrupted' | 'cancelled';
  event_data: any;
  abort_controller: AbortController;
  heartbeat_interval?: number;
}

// Global state for graceful shutdown and active executions
class GracefulShutdownManager {
  private activeExecutions = new Map<string, WorkflowExecution>();
  private isShuttingDown = false;
  private functionInstanceId = crypto.randomUUID();

  constructor() {
    // Setup graceful shutdown handling
    addEventListener('beforeunload', async (ev) => {
      console.log('Graceful shutdown initiated:', ev.detail?.reason);
      this.isShuttingDown = true;
      
      // Mark all active executions as interrupted
      for (const [executionId, execution] of this.activeExecutions) {
        console.log(`Marking execution ${executionId} as shutdown interrupted`);
        
        // Clear heartbeat interval
        if (execution.heartbeat_interval) {
          clearInterval(execution.heartbeat_interval);
        }
        
        // Abort the execution
        execution.abort_controller.abort();
        
        // Update database status
        await this.markExecutionShutdownInterrupted(
          executionId, 
          this.getShutdownReason(ev.detail?.reason)
        );
      }
      
      console.log(`Marked ${this.activeExecutions.size} executions as shutdown interrupted`);
    });
  }

  private getShutdownReason(reason?: string): string {
    if (!reason) return 'unknown';
    
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('timeout')) return 'timeout';
    if (lowerReason.includes('memory')) return 'memory_limit';
    if (lowerReason.includes('cold')) return 'cold_start_timeout';
    if (lowerReason.includes('maintenance')) return 'platform_maintenance';
    return 'manual_termination';
  }

  async createExecution(
    messageId: bigint, 
    workflowName: string, 
    eventData: any
  ): Promise<WorkflowExecution | null> {
    if (this.isShuttingDown) {
      console.log('Shutdown in progress, refusing new execution');
      return null;
    }

    try {
      // Create execution record in database
      const { data, error } = await supabase
        .from('workflow_executions')
        .insert({
          message_id: messageId,
          workflow_name: workflowName,
          status: 'pending',
          event_data: eventData,
          function_instance_id: this.functionInstanceId,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create execution record:', error);
        return null;
      }

      const execution: WorkflowExecution = {
        id: data.id,
        message_id: messageId,
        workflow_name: workflowName,
        status: 'pending',
        event_data: eventData,
        abort_controller: new AbortController(),
      };

      this.activeExecutions.set(data.id, execution);
      return execution;
    } catch (error) {
      console.error('Error creating execution:', error);
      return null;
    }
  }

  async startExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || this.isShuttingDown) return false;

    try {
      // Update status to processing
      const { error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      if (error) {
        console.error('Failed to start execution:', error);
        return false;
      }

      execution.status = 'processing';

      // Start heartbeat
      execution.heartbeat_interval = setInterval(async () => {
        if (!this.isShuttingDown) {
          await this.updateHeartbeat(executionId);
        }
      }, 5000); // Heartbeat every 5 seconds

      return true;
    } catch (error) {
      console.error('Error starting execution:', error);
      return false;
    }
  }

  async completeExecution(executionId: string, resultData?: any): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    // Clear heartbeat interval
    if (execution.heartbeat_interval) {
      clearInterval(execution.heartbeat_interval);
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: now,
          result_data: resultData || {},
        })
        .eq('id', executionId);

      if (error) {
        console.error('Failed to complete execution:', error);
      }

      this.activeExecutions.delete(executionId);
    } catch (error) {
      console.error('Error completing execution:', error);
    }
  }

  async failExecution(executionId: string, error: any): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    // Clear heartbeat interval
    if (execution.heartbeat_interval) {
      clearInterval(execution.heartbeat_interval);
    }

    try {
      const now = new Date().toISOString();
      const { error: dbError } = await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          completed_at: now,
          error_message: error?.message || String(error),
          error_details: {
            stack: error?.stack,
            name: error?.name,
            cause: error?.cause,
          },
        })
        .eq('id', executionId);

      if (dbError) {
        console.error('Failed to fail execution:', dbError);
      }

      this.activeExecutions.delete(executionId);
    } catch (dbError) {
      console.error('Error failing execution:', dbError);
    }
  }

  private async markExecutionShutdownInterrupted(
    executionId: string, 
    reason: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'shutdown_interrupted',
          shutdown_detected_at: new Date().toISOString(),
          shutdown_reason: reason,
        })
        .eq('id', executionId);

      if (error) {
        console.error('Failed to mark execution as shutdown interrupted:', error);
      }
    } catch (error) {
      console.error('Error marking execution as shutdown interrupted:', error);
    }
  }

  private async updateHeartbeat(executionId: string): Promise<void> {
    try {
      await supabase.rpc('update_execution_heartbeat', {
        execution_id: executionId,
      });
    } catch (error) {
      console.error('Failed to update heartbeat:', error);
    }
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}

// Global shutdown manager instance
const shutdownManager = new GracefulShutdownManager();

/**
 * Process a message from the queue with comprehensive execution tracking and graceful shutdown
 * @param message - The queue message to process
 * @param processor - The function to process the message payload
 */
async function processMessageWithCleanup(
  message: QueueMessage,
  processor: (payload: any, abortSignal: AbortSignal) => Promise<any>
): Promise<void> {
  const msgId = message.msg_id;
  const payload = message.message;

  console.log(
    `Processing message ${msgId} read_ct=${message.read_ct} for workflow: ${payload.workflow_name}`
  );

  // Check if message has exceeded retry limit
  if (message.read_ct > 3) {
    console.log(`Message ${msgId} has exceeded retry limit (${message.read_ct} > 3), removing from queue`);
    
    // Delete the message from the queue
    const { error: deleteError } = await supabase
      .schema('pgmq_public')
      .rpc('delete', {
        queue_name: 'workflow_messages',
        msg_id: msgId,
      });

    if (deleteError) {
      console.error(`Failed to delete expired message ${msgId}:`, deleteError);
    } else {
      console.log(`Expired message ${msgId} deleted from queue`);
    }

    // Create a failed execution record for tracking
    const { error: recordError } = await supabase
      .from('workflow_executions')
      .insert({
        message_id: msgId,
        workflow_name: payload.workflow_name,
        status: 'failed',
        event_data: payload,
        error_message: 'Exceeded maximum retry attempts',
        error_details: {
          retry_count: message.read_ct,
          max_retries: 3
        },
        completed_at: new Date().toISOString()
      });

    if (recordError) {
      console.error('Failed to create failed execution record:', recordError);
    }

    return;
  }

  // Create execution tracking record
  const execution = await shutdownManager.createExecution(
    msgId,
    payload.workflow_name,
    payload
  );

  if (!execution) {
    console.error(`Failed to create execution record for message ${msgId}`);
    return;
  }

  console.log(`Created execution ${execution.id} for message ${msgId}`);

  // Create the background task that processes and cleans up
  const backgroundTask = async () => {
    const startTime = Date.now();
    let processorResult: any;

    try {
      // Start execution tracking
      const started = await shutdownManager.startExecution(execution.id);
      if (!started) {
        console.log(`Failed to start execution ${execution.id} or shutdown in progress`);
        return;
      }

      console.log(`Started execution ${execution.id} for workflow: ${payload.workflow_name}`);

      // Call the processor function with abort signal
      processorResult = await processor(payload, execution.abort_controller.signal);

      const executionTime = Date.now() - startTime;
      console.log(
        `Successfully processed message ${msgId} in ${executionTime}ms, deleting from queue`
      );

      // Complete execution tracking
      await shutdownManager.completeExecution(execution.id, processorResult);

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

      // Update execution time in database
      await supabase
        .from('workflow_executions')
        .update({ execution_time_ms: executionTime })
        .eq('id', execution.id);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Error processing message ${msgId} after ${executionTime}ms:`, error);
      
      // Check if this was an abort error due to shutdown
      if (error.name === 'AbortError') {
        console.log(`Execution ${execution.id} was aborted due to shutdown`);
      } else {
        // Mark execution as failed
        await shutdownManager.failExecution(execution.id, error);
        
        // Update execution time even for failed executions
        await supabase
          .from('workflow_executions')
          .update({ execution_time_ms: executionTime })
          .eq('id', execution.id);
      }
      
      // Message stays in queue for retry since we don't delete on error
      // Increment retry count on the message (this could be enhanced with a custom PGMQ function)
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
 * Invoke the actual workflow function via Supabase with abort signal support
 */
async function processWorkflowMessage(payload: any, abortSignal: AbortSignal): Promise<any> {
  const { workflow_name, event } = payload;

  console.log(
    `Invoking workflow: ${workflow_name}`,
    JSON.stringify(event, null, 2)
  );

  try {
    // Check if already aborted before making the request
    if (abortSignal.aborted) {
      throw new Error('AbortError');
    }

    // Create a timeout promise to race against the function invocation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Function invocation timeout')), 300000); // 5 minutes
    });

    // Create the abort promise
    const abortPromise = new Promise((_, reject) => {
      abortSignal.addEventListener('abort', () => {
        reject(new Error('AbortError'));
      });
    });

    // Use Supabase service client to invoke the Edge Function
    // Note: Supabase JS client doesn't natively support AbortSignal for function invocation
    // This is a limitation we're working around with Promise.race
    const invocationPromise = supabase.functions.invoke(workflow_name, {
      body: event,
    });

    const { data, error } = await Promise.race([
      invocationPromise,
      timeoutPromise,
      abortPromise
    ]) as any;

    if (error) {
      throw new Error(`Workflow ${workflow_name} failed: ${error.message}`);
    }

    console.log(`Workflow ${workflow_name} completed successfully:`, data);
    return data;
  } catch (error) {
    // Check if this is an abort error
    if (error.message === 'AbortError' || abortSignal.aborted) {
      console.log(`Workflow ${workflow_name} was aborted`);
      const abortError = new Error('Workflow execution was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    console.error(`Failed to invoke workflow ${workflow_name}:`, error);
    throw error; // Re-throw to prevent message deletion
  }
}

Deno.serve(async (req) => {
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
});
