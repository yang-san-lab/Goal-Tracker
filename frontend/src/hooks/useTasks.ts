import { useState, useEffect, useCallback } from 'react'
import type { DailyTasks, Task, WeekProgress } from '../types'
import * as tasksApi from '../api/tasks'

export function useDailyTasks(date?: string) {
  const [data, setData] = useState<DailyTasks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await tasksApi.getDailyTasks(date)
      setData(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { refresh() }, [refresh])

  const checkin = useCallback(async (
    taskId: string,
    action: 'completed' | 'delayed' | 'skipped',
    note: string = '',
  ) => {
    const updated = await tasksApi.checkinTask({ task_id: taskId, action, note })
    // 本地更新
    if (data) {
      setData({
        ...data,
        tasks: data.tasks.map(t => t.id === taskId ? updated : t),
        completion_rate: data.tasks.length
          ? data.tasks.filter(t => t.id === taskId ? updated.status === 'completed' : t.status === 'completed').length / data.tasks.length
          : 0,
      })
    }
    return updated
  }, [data])

  const updateSchedule = useCallback(async (
    taskId: string,
    scheduledTime: string | null,
    reminderMinutes: number | null,
  ) => {
    const updated = await tasksApi.updateTaskSchedule(taskId, {
      scheduled_time: scheduledTime,
      reminder_minutes: reminderMinutes,
    })
    setData(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? updated : t),
    } : prev)
    return updated
  }, [])

  return { data, loading, error, refresh, checkin, updateSchedule }
}

export function useWeekProgress(weekStart?: string) {
  const [data, setData] = useState<WeekProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    tasksApi.getWeekProgress(weekStart)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [weekStart])

  return { data, loading }
}
