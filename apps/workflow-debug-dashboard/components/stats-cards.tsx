'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase, type WorkflowExecutionStats, type ActiveWorkflowExecution } from '@/lib/supabase'
import { formatDuration } from '@/lib/utils'
import { Activity, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface StatsData {
  totalExecutions: number
  activeExecutions: number
  successRate: number
  avgExecutionTime: number | null
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData>({
    totalExecutions: 0,
    activeExecutions: 0,
    successRate: 0,
    avgExecutionTime: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  const loadStats = async () => {
    try {
      // Load aggregated stats
      const { data: statsData, error: statsError } = await supabase
        .from('workflow_execution_stats')
        .select('*')

      // Load active executions
      const { data: activeData, error: activeError } = await supabase
        .from('active_workflow_executions')
        .select('*')

      if (statsError) {
        console.error('Error loading stats:', statsError)
        return
      }

      if (activeError) {
        console.error('Error loading active executions:', activeError)
        return
      }

      // Calculate totals from stats
      const totalExecs = statsData?.reduce((sum, stat) => sum + (stat.total_executions || 0), 0) || 0
      const totalSuccessful = statsData?.reduce((sum, stat) => sum + (stat.successful_executions || 0), 0) || 0
      const successRate = totalExecs > 0 ? (totalSuccessful / totalExecs) * 100 : 0

      // Calculate average execution time weighted by successful executions
      let totalTime = 0
      let totalCompleted = 0
      statsData?.forEach(stat => {
        if (stat.avg_execution_time_ms && stat.successful_executions) {
          totalTime += stat.avg_execution_time_ms * stat.successful_executions
          totalCompleted += stat.successful_executions
        }
      })
      const avgExecutionTime = totalCompleted > 0 ? Math.round(totalTime / totalCompleted) : null

      setStats({
        totalExecutions: totalExecs,
        activeExecutions: activeData?.length || 0,
        successRate,
        avgExecutionTime,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()

    // Set up real-time subscriptions for workflow executions
    const executionSubscription = supabase
      .channel('workflow_executions_stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions',
        },
        () => {
          // Reload stats when executions change
          loadStats()
        }
      )
      .subscribe()

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000)

    return () => {
      executionSubscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const cards = [
    {
      title: 'Total Executions',
      value: isLoading ? '-' : stats.totalExecutions.toLocaleString(),
      icon: Activity,
      description: 'All time workflow runs',
    },
    {
      title: 'Active Jobs',
      value: isLoading ? '-' : stats.activeExecutions.toString(),
      icon: Clock,
      description: 'Currently processing',
      showPulse: stats.activeExecutions > 0,
    },
    {
      title: 'Success Rate',
      value: isLoading ? '-' : `${stats.successRate.toFixed(1)}%`,
      icon: CheckCircle,
      description: 'Completed successfully',
    },
    {
      title: 'Avg Duration',
      value: isLoading ? '-' : formatDuration(stats.avgExecutionTime),
      icon: AlertCircle,
      description: 'Average execution time',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className="relative">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {card.showPulse && (
                  <div className="absolute -top-1 -right-1 h-2 w-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-ping"></div>
                    <div className="absolute top-0 h-2 w-2 rounded-full bg-green-500"></div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}