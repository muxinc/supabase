'use client'

import { StatsCards } from '@/components/stats-cards'
import { ExecutionTable } from '@/components/execution-table'
import { WorkflowActions } from '@/components/workflow-actions'
import { useToast } from '@/hooks/use-toast'
import { Monitor } from 'lucide-react'

export default function Dashboard() {
  const { toast } = useToast()

  const { resubmitWorkflow, cancelWorkflow, submitTestWebhook, TestWebhookCard } = WorkflowActions({
    onSuccess: (message) => {
      toast({
        title: "Success",
        description: message,
        variant: "default",
      })
    },
    onError: (message) => {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    }
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-3">
            <Monitor className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Workflow Debug Dashboard</h1>
              <p className="text-muted-foreground">
                Monitor, manage, and debug your workflow executions in real-time
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Statistics */}
          <StatsCards />
          
          {/* Test Webhook and Actions */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <TestWebhookCard />
            </div>
            
            {/* Future: Add more action cards here */}
            <div className="lg:col-span-2">
              {/* Placeholder for future features like bulk actions, system health, etc. */}
            </div>
          </div>

          {/* Execution Table */}
          <ExecutionTable
            onResubmit={resubmitWorkflow}
            onCancel={cancelWorkflow}
          />
        </div>
      </div>
    </div>
  )
}