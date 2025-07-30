import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

interface WorkflowOutputData {
  slug: string;
  version: string;
  started_at: string | Date;
  completed_at: string | Date;
  mux_asset_id: string;
  output_data: any;
}

export async function writeWorkflowOutput({
  slug,
  version,
  started_at,
  completed_at,
  mux_asset_id,
  output_data,
}: WorkflowOutputData): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for database writes'
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const insertData = {
    slug,
    version,
    started_at:
      started_at instanceof Date ? started_at.toISOString() : started_at,
    completed_at:
      completed_at instanceof Date ? completed_at.toISOString() : completed_at,
    mux_asset_id,
    output: output_data,
  };

  console.log(
    'About to call supabase.from("mux_workflow_outputs").insert() with full data'
  );

  const { data, error } = await supabase
    .from('mux_workflow_outputs')
    .insert(insertData);

  console.log('Database insert completed');
  console.log('Data returned:', data);
  console.log('Error returned:', error);

  if (error) {
    console.error('Failed to write workflow output:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      ...error,
    });
  }
  console.log('Successfully wrote workflow output for asset:', mux_asset_id);
}
