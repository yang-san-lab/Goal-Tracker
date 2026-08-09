import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDailyTasks } from '../hooks/useTasks'
import TaskCard from '../components/TaskCard'
import ProgressBar from '../components/ProgressBar'

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${m}月${d}日 ${weekdays[date.getDay()]}`
  } catch {
    return dateStr
  }
}

function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 本地日期加减，返回 YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function DailyViewPage() {
  const { date } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const targetDate = date || getToday()
  const { data, loading, error, refresh, checkin } = useDailyTasks(targetDate)

  const [checkinNote, setCheckinNote] = useState('')
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null)

  // 日期导航
  const changeDate = (days: number) => {
    navigate(`/daily/${addDays(targetDate, days)}`)
  }

  const isToday = targetDate === getToday()

  const handleCheckin = async (
    taskId: string,
    action: 'completed' | 'delayed' | 'skipped',
  ) => {
    setCheckinLoading(taskId)
    try {
      await checkin(taskId, action, checkinNote || undefined)
      setCheckinNote('')
    } catch (err: any) {
      alert('打卡失败: ' + err.message)
    } finally {
      setCheckinLoading(null)
    }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* 日期选择器 */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => changeDate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-lg transition-colors active:bg-gray-300"
        >
          ←
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold">{formatDate(targetDate)}</h2>
          {isToday && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">今天</span>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-lg transition-colors active:bg-gray-300"
        >
          →
        </button>
      </div>

      {/* 日期快捷跳转 */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <input
          type="date"
          value={targetDate}
          onChange={e => navigate(`/daily/${e.target.value}`)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        {!isToday && (
          <button
            onClick={() => navigate('/daily')}
            className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100"
          >
            回今天
          </button>
        )}
      </div>

      {/* 进度概览 */}
      {data && (
        <div className="card mb-4">
          <ProgressBar rate={data.completion_rate} label="今日完成率" size="md" />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{data.tasks.length} 个任务</span>
            <span>预计 {data.total_minutes} 分钟</span>
            <span>已完成 {data.completed_minutes} 分钟</span>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="card bg-red-50 text-red-600 text-sm text-center py-8">
          <p>{error}</p>
          <button onClick={refresh} className="mt-2 text-primary-600 underline">重试</button>
        </div>
      ) : data && data.tasks.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>今天没有任务</p>
          <p className="text-sm mt-1">去创建一个目标，AI 会帮你安排每日任务</p>
          <button
            onClick={() => navigate('/goal/new')}
            className="btn-primary mt-4 inline-block"
          >
            创建目标
          </button>
        </div>
      ) : (
        <div>
          {data?.tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onCheckin={handleCheckin}
              loading={checkinLoading === task.id}
            />
          ))}
        </div>
      )}

      {/* 打卡备注（可选） */}
      {data && data.tasks.some(t => t.status === 'pending') && (
        <div className="mt-4">
          <input
            className="input text-sm"
            type="text"
            placeholder="打卡备注（可选）：为什么延期？有什么困难？"
            value={checkinNote}
            onChange={e => setCheckinNote(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
