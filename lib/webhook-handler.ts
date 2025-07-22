import Mux from 'https://esm.sh/@mux/mux-node@12';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const mux = new Mux({
  tokenId: Deno.env.get('MUX_TOKEN_ID'),
  tokenSecret: Deno.env.get('MUX_TOKEN_SECRET')
});

interface MuxConfig {
  events: string[];
}

async function scanForMuxFunctions(): Promise<Map<string, string[]>> {
  const functionEventMap = new Map<string, string[]>();
  const functionsDir =
    '/Users/djhaveri/code/@muxinc/supabase-mux/supabase/functions';

  try {
    // Get all function directories dynamically
    const functionDirs: string[] = [];

    try {
      const dirEntries = Deno.readDirSync(functionsDir);
      for (const entry of dirEntries) {
        if (entry.isDirectory) {
          functionDirs.push(entry.name);
        }
      }
    } catch {
      console.warn('Could not scan functions directory, using fallback');
      functionDirs.push('content-moderation', 'hello-world', 'mux-webhook');
    }

    for (const functionDir of functionDirs) {
      try {
        const tomlPath = `${functionsDir}/${functionDir}/mux.toml`;
        const tomlContent = Deno.readTextFileSync(tomlPath);
        const config = parseSimpleToml(tomlContent);

        if (config.events && Array.isArray(config.events)) {
          functionEventMap.set(functionDir, config.events);
          console.log(
            `Found mux function: ${functionDir} handles events:`,
            config.events
          );
        }
      } catch {
        // Silently skip functions without mux.toml
      }
    }
  } catch (error) {
    console.error('Error scanning for mux functions:', error);
  }

  return functionEventMap;
}

function parseSimpleToml(content: string): MuxConfig {
  const config: MuxConfig = { events: [] };

  // Simple TOML parser for events array
  const eventsMatch = content.match(/events\s*=\s*\[(.*?)\]/s);
  if (eventsMatch) {
    const eventsStr = eventsMatch[1];
    config.events = eventsStr
      .split(',')
      .map((event) => event.trim().replace(/['"]/g, ''))
      .filter((event) => event.length > 0);
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

    const { data: _data, error } = await supabase.functions.invoke(
      functionName,
      {
        body: { muxEvent: event },
      }
    );

    if (error) {
      console.error(`Failed to invoke function ${functionName}:`, error);
    } else {
      console.log(`Successfully invoked function: ${functionName}`);
    }
  } catch (error) {
    console.error(`Error invoking function ${functionName}:`, error);
  }
}

export async function handleMuxWebhook(req: Request): Promise<void> {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    const event = mux.webhooks.unwrap(body, headers);

    console.log('Received Mux webhook:', JSON.stringify(event, null, 2));

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
  } catch (error) {
    console.error('Failed to process Mux webhook:', error);
    throw error;
  }
}
