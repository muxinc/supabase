'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase, type WorkflowExecution } from '@/lib/supabase'
import { RotateCcw, Send, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkflowActionsProps {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function WorkflowActions({ onSuccess, onError }: WorkflowActionsProps) {
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [isSubmittingTest, setIsSubmittingTest] = useState(false)

  const resubmitWorkflow = async (execution: WorkflowExecution) => {
    setIsResubmitting(true)
    try {
      // Extract the original event from event_data
      // event_data contains the full payload, so we need to extract just the event part
      const messagePayload = execution.event_data?.event || execution.event_data
      
      // Directly call pgmq to resubmit the workflow to the queue
      const { data, error } = await supabase
        .schema('pgmq_public')
        .rpc('send', {
          queue_name: 'workflow_messages',
          message: {
            workflow_name: execution.workflow_name,
            event: messagePayload
          }
        })

      if (error) {
        throw error
      }

      onSuccess?.(`Successfully resubmitted ${execution.workflow_name}`)
    } catch (error: any) {
      console.error('Error resubmitting workflow:', error)
      onError?.(`Failed to resubmit workflow: ${error.message}`)
    } finally {
      setIsResubmitting(false)
    }
  }

  const cancelWorkflow = async (execution: WorkflowExecution) => {
    try {
      // Update the execution status to cancelled
      const { error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: 'Manually cancelled via debug UI'
        })
        .eq('id', execution.id)
        .eq('status', 'processing')

      if (error) {
        throw error
      }

      onSuccess?.(`Successfully cancelled ${execution.workflow_name}`)
    } catch (error: any) {
      console.error('Error cancelling workflow:', error)
      onError?.(`Failed to cancel workflow: ${error.message}`)
    }
  }

  const submitTestWebhook = async () => {
    setIsSubmittingTest(true)
    try {
      // Example test webhook data
      const testMessage = {
        workflow_name: 'content-moderation',
        event: {
          type: 'video.asset.ready',
          id: `test-${Date.now()}`,
          data: {
            id: `test-asset-${Date.now()}`,
            status: 'ready',
            duration: 150.083333,
            playback_ids: [
              { policy: 'public', id: 'test-playbook-id' }
            ],
            meta: { title: 'Debug UI Test Video' }
          },
          created_at: new Date().toISOString()
        }
      }

      // Directly call pgmq to submit test webhook to the queue
      const { data, error } = await supabase
        .schema('pgmq_public')
        .rpc('send', {
          queue_name: 'workflow_messages',
          message: testMessage
        })

      if (error) {
        throw error
      }

      onSuccess?.(`Test webhook submitted successfully for ${testMessage.workflow_name}`)
    } catch (error: any) {
      console.error('Error submitting test webhook:', error)
      onError?.(`Failed to submit test webhook: ${error.message}`)
    } finally {
      setIsSubmittingTest(false)
    }
  }

  return {
    resubmitWorkflow,
    cancelWorkflow,
    submitTestWebhook,
    TestWebhookCard: () => (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300">
                Quick Test
              </p>
              <p className="text-blue-700 dark:text-blue-400">
                Submit a test webhook to the content-moderation workflow for debugging
              </p>
            </div>
          </div>
          
          <Button
            onClick={submitTestWebhook}
            disabled={isSubmittingTest}
            className="w-full"
          >
            <Send className={cn('h-4 w-4 mr-2', isSubmittingTest && 'animate-pulse')} />
            {isSubmittingTest ? 'Submitting...' : 'Submit Test Webhook'}
          </Button>
        </CardContent>
      </Card>
    )
  }
}