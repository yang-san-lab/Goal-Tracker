import { useState, useEffect, useRef } from 'react'
import type { Task } from '../types'

interface Props {
  task: Task
  onCheckin: (taskId: string, action: 'completed' | 'delayed' | 'skipped') => void
  loading?: boolean
  onUpdateSchedule?: (taskId: string, scheduledTime: string | null, reminderTime: string | null) => void | Promise<void>
  scheduleSaving?: boolean
}

const statusColors: Record<string, string> = {
  pending: 'border-l-4 border-l-yellow-400',
  completed: 'border-l-4 border-l-green-400 opacity-70',
  delayed: 'border-l-4 border-l-red-400',
  skipped: 'border-l-4 border-l-gray-300 opacity-50',
}

// 团队任务的 pending 状态使用蓝色边框
function getBorderClass(task: Task): string {
  if (task.assignment_type === 'assigned' && task.status === 'pending') {
    return 'border-l-4 border-l-blue-400'
  }
  if (task.assignment_type === 'assigned' && task.status === 'completed') {
    return 'border-l-4 border-l-green-400 opacity-70'
  }
  return statusColors[task.status] || ''
}

const categoryIcons: Record<string, string> = {
  '学习': '📚',
  '工作': '💼',
  '健康': '🏃',
  '生活': '🏠',
  '复习': '🔄',
}

const priorityLabels: Record<number, string> = {
  1: '🔥高',
  2: '⚡中高',
  3: '📌中',
  4: '🔹中低',
  5: '⏳低',
}

/** 完成庆祝动画 —— 短暂的星星爆发 */
function StarBurst({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1200)
    return () => clearTimeout(timer)
  }, [onDone])

  const stars = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 160,
    y: -(Math.random() * 100 + 40),
    rotate: (Math.random() - 0.5) * 360,
    delay: Math.random() * 0.2,
    size: 12 + Math.random() * 16,
  }))

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
      {stars.map(s => (
        <span
          key={s.id}
          className="absolute text-yellow-400"
          style={{
            fontSize: s.size,
            left: '50%',
            top: '50%',
            animation: `starBurst 1s ease-out forwards`,
            animationDelay: `${s.delay}s`,
            '--tx': `${s.x}px`,
            '--ty': `${s.y}px`,
            '--rot': `${s.rotate}deg`,
          } as React.CSSProperties}
        >
          ⭐
        </span>
      ))}
    </div>
  )
}

export default function TaskCard({ task, onCheckin, loading, onUpdateSchedule, scheduleSaving }: Props) {
  const isDone = task.status === 'completed'
  const isSkipped = task.status === 'skipped'
  const [showBurst, setShowBurst] = useState(false)
  const prevDoneRef = useRef(isDone)

  // 只在任务从未完成→完成时触发动画（不是初次加载时已有的完成状态）
  useEffect(() => {
    const wasDone = prevDoneRef.current
    prevDoneRef.current = isDone
    // 只有从非完成变成完成时才触发
    if (isDone && !wasDone) {
      setShowBurst(true)
    }
  }, [isDone])

  const handleComplete = () => {
    onCheckin(task.id, 'completed')
  }

  return (
    <div
      className={`card mb-3 relative overflow-hidden transition-all duration-300 ${getBorderClass(task)}`}
    >
      {/* 完成庆祝动画 */}
      {showBurst && <StarBurst onDone={() => setShowBurst(false)} />}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* 第一行：类别 + 优先级 + 时长 + 星星 */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm">
              {categoryIcons[task.category] || '📌'}
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {task.category || '其他'}
            </span>
            <span className="text-xs text-gray-400">
              {priorityLabels[task.priority] || `P${task.priority}`}
            </span>
            <span className="text-xs text-gray-400">⏱ {task.duration_minutes}分</span>
            {task.earnable_stars > 0 && (
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full font-medium">
                +{task.earnable_stars}⭐
              </span>
            )}
          </div>

          {/* 第二行：任务标题 */}
          <p className={`font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>

          {onUpdateSchedule && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <input
                type="text"
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 w-16"
                placeholder="HH:MM"
                value={task.scheduled_time ?? ''}
                disabled={scheduleSaving}
                onChange={e => {
                  const val = e.target.value
                  onUpdateSchedule(task.id, val || null, task.reminder_time)
                }}
              />
              <select
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                value={(() => {
                  if (task.reminder_time == null || !task.scheduled_time) return ''
                  const [sh, sm] = task.scheduled_time.split(':').map(Number)
                  const [rh, rm] = task.reminder_time.split(':').map(Number)
                  return String(Math.max((sh * 60 + sm) - (rh * 60 + rm), 0))
                })()}
                disabled={scheduleSaving || !task.scheduled_time}
                onChange={e => {
                  const val = e.target.value
                  if (val === '' || !task.scheduled_time) {
                    onUpdateSchedule(task.id, task.scheduled_time, null)
                    return
                  }
                  const mins = Number(val)
                  const [h, m] = task.scheduled_time.split(':').map(Number)
                  const totalMin = (h * 60 + m - mins + 1440) % 1440
                  const newHh = String(Math.floor(totalMin / 60)).padStart(2, '0')
                  const newMm = String(totalMin % 60).padStart(2, '0')
                  onUpdateSchedule(task.id, task.scheduled_time, `${newHh}:${newMm}`)
                }}
              >
                <option value="">不提醒</option>
                <option value="0">准时提醒</option>
                <option value="5">提前5分钟</option>
                <option value="10">提前10分钟</option>
                <option value="15">提前15分钟</option>
                <option value="30">提前30分钟</option>
                <option value="60">提前1小时</option>
                <option value="120">提前2小时</option>
              </select>
            </div>
          )}

          {/* 目标名 */}
          {task.goal_title && (
            <p className="text-xs text-gray-400 mt-0.5">
              🎯 {task.goal_title}
            </p>
          )}

          {/* 团队标记 */}
          {task.assignment_type === 'assigned' && task.team_name && (
            <p className="text-xs text-blue-500 mt-0.5">
              👥 {task.team_name}
              {task.assigned_by_username && (
                <span className="text-gray-400"> · 来自 {task.assigned_by_username}</span>
              )}
            </p>
          )}

          {task.user_note && (
            <p className="text-xs text-gray-400 mt-1">💬 {task.user_note}</p>
          )}
          {task.delayed_reason && (
            <p className="text-xs text-red-400 mt-1">⚠ {task.delayed_reason}</p>
          )}
        </div>

        {/* 操作按钮 */}
        {!isDone && !isSkipped && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={handleComplete}
              disabled={loading}
              className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50"
            >
              ✅ 完成
            </button>
            <button
              onClick={() => onCheckin(task.id, 'delayed')}
              disabled={loading}
              className="px-3 py-1.5 bg-orange-100 text-orange-600 text-xs rounded-lg hover:bg-orange-200 active:scale-95 transition-all disabled:opacity-50"
            >
              ⏸️ 延期
            </button>
            <button
              onClick={() => onCheckin(task.id, 'skipped')}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-lg hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
            >
              ⏭ 跳过
            </button>
          </div>
        )}
        {isDone && <span className="text-2xl shrink-0 animate-bounce-in">✅</span>}
        {isSkipped && <span className="text-2xl shrink-0">⏭️</span>}
      </div>
    </div>
  )
}
