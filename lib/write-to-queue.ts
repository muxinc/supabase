import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function writeWorkflowMessage(workflowName: string, event: any) {
  const result = await supabase.schema('pgmq_public').rpc('send', {
    queue_name: 'workflow_messages',
    message: {
      workflow_name: workflowName,
      event,
    },
  });
  if (result.error) {
    console.error(
      'Error writing workflow message:',
      workflowName,
      result.error
    );
  } else {
    console.log('Wrote workflow message:', workflowName, result);
  }
  return result;
}
