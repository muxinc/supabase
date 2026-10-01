import { createClient } from '@supabase/supabase-js';
import { parse as parseToml } from 'toml';
import { Mux } from '@mux/ts';

// Not exported by @mux/ts
type HeadersLike = Parameters<Mux['webhooks']['unwrap']>[1];

interface WorkflowConfig {
  [functionName: string]: string[];
}

async function scanForMuxFunctions(): Promise<Map<string, string[]>> {
  const functionEventMap = new Map<string, string[]>();
  const tomlPath = './mux.toml';

  try {
    const tomlContent = await Deno.readTextFile(tomlPath);
    const config = parseWorkflowToml(tomlContent);

    for (const [functionName, events] of Object.entries(config)) {
      if (Array.isArray(events)) {
        functionEventMap.set(functionName, events);
        console.log(
          `Found mux function: ${functionName} handles events:`,
          events
        );
      }
    }
    console.log(`Loaded mux configuration from: ${tomlPath}`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(
        'Did not find mux.toml in supabase/functions/mux-webhook/mux.toml'
      );
    } else {
      console.log(
        `Error reading mux.toml file. It should be in supabase/functions/mux-webhook/mux.toml`
      );
      console.error(error);
    }
  }

  return functionEventMap;
}

function parseWorkflowToml(content: string): WorkflowConfig {
  const config: WorkflowConfig = {};

  try {
    const parsed = parseToml(content) as any;

    if (parsed.workflows && typeof parsed.workflows === 'object') {
      for (const [functionName, workflow] of Object.entries(parsed.workflows)) {
        if (workflow && typeof workflow === 'object' && 'events' in workflow) {
          const events = (workflow as any).events;
          if (Array.isArray(events)) {
            config[functionName] = events;
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to parse TOML:', error);
  }

  return config;
}

async function invokeMuxFunction(
  functionName: string,
  event: any
): Promise<void> {
  try {
    // Create Supabase client for writing to the pgmq queue
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const result = await supabase.schema('pgmq_public').rpc('send', {
      queue_name: 'workflow_messages',
      message: {
        workflow_name: functionName,
        event,
      },
    });
    if (result.error) {
      console.error(
        'Error writing workflow message:',
        functionName,
        result.error
      );
    } else {
      console.log('Wrote workflow message:', functionName, result);
    }
    return result;
  } catch (error) {
    console.error(`Error invoking function ${functionName}:`, error);
  }
}

type Response = {
  message?: string;
  error?: string;
};

export async function queueWorkflowsForEvent(
  payload: string,
  headers: HeadersLike
): Promise<Response> {
  try {
    const mux = new Mux({
      tokenId: Deno.env.get('MUX_TOKEN_ID'),
      tokenSecret: Deno.env.get('MUX_TOKEN_SECRET'),
      webhookSecret: Deno.env.get('MUX_WEBHOOK_SECRET'),
    });
    const event = await mux.webhooks.unwrap(payload, headers);
    console.log('Received Mux webhook:', event.type);

    // Scan for functions that handle this event type
    const functionEventMap = await scanForMuxFunctions();
    const matchingFunctions: string[] = [];

    for (const [functionName, events] of functionEventMap) {
      if (events.includes(event.type)) {
        matchingFunctions.push(functionName);
      }
    }

    if (matchingFunctions.length > 0) {
      console.log(
        `Found ${matchingFunctions.length} function(s) to handle event ${event.type}:`,
        matchingFunctions
      );

      // Invoke all matching functions
      await Promise.all(
        matchingFunctions.map((functionName) =>
          invokeMuxFunction(functionName, event)
        )
      );
    } else {
      console.log('No functions configured to handle event type:', event.type);
    }
    return { message: 'Workflow queuing succeeded' };
  } catch (error) {
    console.error('Failed to process Mux webhook:', error);
    return { error: 'Worfklow queuing failed' };
  }
}
