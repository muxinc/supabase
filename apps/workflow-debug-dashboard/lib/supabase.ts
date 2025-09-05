import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types based on our database schema
export interface WorkflowExecution {
  id: string
  message_id: bigint
  workflow_name: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'shutdown_interrupted' | 'cancelled'
  created_at: string
  started_at: string | null
  completed_at: string | null
  last_heartbeat: string | null
  execution_time_ms: number | null
  error_message: string | null
  error_details: any
  retry_count: number
  shutdown_detected_at: string | null
  shutdown_reason: string | null
  shutdown_cleanup_completed: boolean
  event_data: any
  result_data: any
  function_instance_id: string | null
  created_by: string | null
}

export interface WorkflowExecutionStats {
  workflow_name: string
  total_executions: number
  successful_executions: number
  failed_executions: number
  shutdown_interrupted_executions: number
  avg_execution_time_ms: number | null
  max_execution_time_ms: number | null
  avg_retry_count: number
  max_retry_count: number
}

export interface ActiveWorkflowExecution {
  id: string
  message_id: bigint
  workflow_name: string
  status: string
  started_at: string
  last_heartbeat: string | null
  running_time_ms: number
  time_since_heartbeat_ms: number | null
  retry_count: number
  shutdown_detected: boolean
  function_instance_id: string | null
}