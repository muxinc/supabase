import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Mux from 'npm:@mux/mux-node@12';
import type { UnwrapWebhookEvent } from 'npm:@mux/mux-node@12';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parse as parseToml } from 'jsr:@std/toml';
import { writeWorkflowMessage } from './write-to-queue.ts';

const mux = new Mux();

interface WorkflowConfig {
  [functionName: string]: string[];
}

async function scanForMuxFunctions(): Promise<Map<string, string[]>> {
  const functionEventMap = new Map<string, string[]>();

  // Try to find the centralized mux.toml file
  const possibleTomlPaths = [
    './mux.toml',
    '../mux.toml',
    '../../mux.toml',
    './supabase/functions/mux-webhook/mux.toml',
    '/home/deno/functions/mux-webhook/mux.toml',
  ];

  for (const tomlPath of possibleTomlPaths) {
    try {
      const tomlContent = Deno.readTextFileSync(tomlPath);
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
      break;
    } catch {
      // Continue to next path
    }
  }

  if (functionEventMap.size === 0) {
    console.warn('Could not load mux.toml, using fallback configuration');
    functionEventMap.set('content-moderation', ['video.asset.ready']);
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
    // Create Supabase client for function invocation
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await writeWorkflowMessage(functionName, event);

    console.log('Wrote workflow message:', functionName);
  } catch (error) {
    console.error(`Error invoking function ${functionName}:`, error);
  }
}

export async function handleMuxWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    const body = await req.text();
    const event = JSON.parse(body) as UnwrapWebhookEvent;

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
    return new Response(
      JSON.stringify({ message: 'Webhook processed successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Failed to process Mux webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
