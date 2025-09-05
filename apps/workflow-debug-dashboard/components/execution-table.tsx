'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase, type WorkflowExecution } from '@/lib/supabase'
import { formatDuration, formatRelativeTime, getStatusColor, formatJSON } from '@/lib/utils'
import { Eye, RotateCcw, X, Filter, RefreshCw } from 'lucide-react'

interface ExecutionTableProps {
  onResubmit?: (execution: WorkflowExecution) => void
  onCancel?: (execution: WorkflowExecution) => void
}

export function ExecutionTable({ onResubmit, onCancel }: ExecutionTableProps) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null)
  const [filters, setFilters] = useState({
    workflow_name: '',
    status: '',
    limit: 50,
  })
  const [workflowNames, setWorkflowNames] = useState<string[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadExecutions = async () => {
    try {
      console.log('Loading executions with filters:', filters)
      
      let query = supabase
        .from('workflow_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters.limit)

      if (filters.workflow_name && filters.workflow_name !== 'all') {
        query = query.eq('workflow_name', filters.workflow_name)
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading executions:', error)
        console.error('Error details:', { 
          message: error.message, 
          details: error.details,
          hint: error.hint,
          code: error.code 
        })
        return
      }

      console.log('Loaded executions:', data?.length || 0, 'rows')
      setExecutions(data || [])

      // Extract unique workflow names for filter
      if (data) {
        const names = Array.from(new Set(data.map(e => e.workflow_name)))
        setWorkflowNames(prev => {
          const combined = Array.from(new Set([...prev, ...names]))
          return combined.sort()
        })
      }
    } catch (error) {
      console.error('Error loading executions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadWorkflowNames = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_execution_stats')
        .select('workflow_name')

      if (!error && data) {
        setWorkflowNames(data.map(d => d.workflow_name).sort())
      }
    } catch (error) {
      console.error('Error loading workflow names:', error)
    }
  }

  useEffect(() => {
    loadExecutions()
    loadWorkflowNames()
  }, [filters])

  // Temporarily disabled realtime subscription for debugging
  // useEffect(() => {
  //   // Set up real-time subscription
  //   const subscription = supabase
  //     .channel('workflow_executions_table')
  //     .on(
  //       'postgres_changes',
  //       {
  //         event: '*',
  //         schema: 'public',
  //         table: 'workflow_executions',
  //       },
  //       (payload) => {
  //         console.log('Real-time update:', payload)
  //         // Reload executions on any change
  //         loadExecutions()
  //       }
  //     )
  //     .subscribe()

  //   return () => {
  //     subscription.unsubscribe()
  //   }
  // }, [filters])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(loadExecutions, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, filters])

  const handleResubmit = async (execution: WorkflowExecution) => {
    if (!onResubmit) return

    if (confirm(`Are you sure you want to resubmit "${execution.workflow_name}"?`)) {
      onResubmit(execution)
    }
  }

  const handleCancel = async (execution: WorkflowExecution) => {
    if (!onCancel) return

    if (confirm(`Are you sure you want to cancel "${execution.workflow_name}"?`)) {
      onCancel(execution)
    }
  }

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge className={getStatusColor(status)}>
      {status.replace('_', ' ')}
    </Badge>
  )

  const ActionButtons = ({ execution }: { execution: WorkflowExecution }) => (
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedExecution(execution)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Execution Details - {execution.workflow_name}
            </DialogTitle>
          </DialogHeader>
          {selectedExecution && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Basic Info</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedExecution.id}</div>
                    <div><strong>Message ID:</strong> {selectedExecution.message_id.toString()}</div>
                    <div><strong>Status:</strong> <StatusBadge status={selectedExecution.status} /></div>
                    <div><strong>Created:</strong> {new Date(selectedExecution.created_at).toLocaleString()}</div>
                    {selectedExecution.started_at && (
                      <div><strong>Started:</strong> {new Date(selectedExecution.started_at).toLocaleString()}</div>
                    )}
                    {selectedExecution.completed_at && (
                      <div><strong>Completed:</strong> {new Date(selectedExecution.completed_at).toLocaleString()}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Performance</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Execution Time:</strong> {formatDuration(selectedExecution.execution_time_ms)}</div>
                    <div><strong>Retry Count:</strong> {selectedExecution.retry_count}</div>
                    {selectedExecution.function_instance_id && (
                      <div><strong>Instance ID:</strong> {selectedExecution.function_instance_id.slice(0, 8)}...</div>
                    )}
                    {selectedExecution.last_heartbeat && (
                      <div><strong>Last Heartbeat:</strong> {formatRelativeTime(selectedExecution.last_heartbeat)}</div>
                    )}
                  </div>
                </div>
              </div>

              {selectedExecution.error_message && (
                <div>
                  <h4 className="font-semibold mb-2">Error Details</h4>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm">
                    <div className="font-medium text-red-800 dark:text-red-400">
                      {selectedExecution.error_message}
                    </div>
                    {selectedExecution.error_details && (
                      <pre className="mt-2 text-xs overflow-x-auto">
                        {formatJSON(selectedExecution.error_details)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Event Data</h4>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  {formatJSON(selectedExecution.event_data)}
                </pre>
              </div>

              {selectedExecution.result_data && Object.keys(selectedExecution.result_data).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Result Data</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    {formatJSON(selectedExecution.result_data)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {(execution.status === 'failed' || execution.status === 'shutdown_interrupted') && onResubmit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResubmit(execution)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}

      {execution.status === 'processing' && onCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCancel(execution)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workflow Executions</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filters.workflow_name || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, workflow_name: value === 'all' ? '' : value }))}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflows</SelectItem>
                {workflowNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="shutdown_interrupted">Interrupted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.limit.toString()} onValueChange={(value) => setFilters(prev => ({ ...prev, limit: parseInt(value) }))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="200">200 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading executions...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No executions found
                  </TableCell>
                </TableRow>
              ) : (
                executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">{execution.workflow_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={execution.status} />
                    </TableCell>
                    <TableCell>{formatRelativeTime(execution.created_at)}</TableCell>
                    <TableCell>{formatDuration(execution.execution_time_ms)}</TableCell>
                    <TableCell>{execution.retry_count}</TableCell>
                    <TableCell>
                      <ActionButtons execution={execution} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}