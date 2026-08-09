import { useState, useEffect, useCallback } from 'react'
import * as teamsApi from '../api/teams'
import type { Task } from '../types'

const priorityLabels: Record<number, string> = {
  1: '🔥高',
  2: '⚡中高',
  3: '📌中',
  4: '🔹中低',
  5: '⏳低',
}

export default function TaskInboxPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadInbox = useCallback(async () => {
    try {
      const data = await teamsApi.getTaskInbox()
      setTasks(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInbox() }, [loadInbox])

  const handleAccept = async (taskId: string) => {
    setActionLoading(taskId)
    try {
      await teamsApi.acceptTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (taskId: string) => {
    setActionLoading(taskId)
    try {
      await teamsApi.rejectTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📨 任务收件箱</h1>
        {tasks.length > 0 && (
          <span className="bg-primary-600 text-white text-xs px-3 py-1 rounded-full font-medium">
            {tasks.length} 个待处理
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📨</p>
          <p className="text-lg mb-2">收件箱是空的</p>
          <p className="text-sm">当队长向你分配任务时，它们会出现在这里</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="card border-l-4 border-l-blue-400">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 来源信息 */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      👥 {task.team_name || '团队任务'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {priorityLabels[task.priority] || `P${task.priority}`}
                    </span>
                    <span className="text-xs text-gray-400">⏱ {task.duration_minutes}分</span>
                  </div>

                  {/* 标题 */}
                  <p className="font-medium text-gray-800">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
                  )}

                  {/* 元信息 */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span>🎯 {task.goal_title}</span>
                    <span>📅 {task.scheduled_date}</span>
                    {task.assigned_by_username && (
                      <span>👤 来自 {task.assigned_by_username}</span>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleAccept(task.id)}
                    disabled={actionLoading === task.id}
                    className="px-4 py-2 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {actionLoading === task.id ? '...' : '✅ 接受'}
                  </button>
                  <button
                    onClick={() => handleReject(task.id)}
                    disabled={actionLoading === task.id}
                    className="px-4 py-2 bg-red-100 text-red-600 text-xs rounded-lg hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {actionLoading === task.id ? '...' : '❌ 拒绝'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
