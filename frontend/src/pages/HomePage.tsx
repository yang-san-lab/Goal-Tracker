import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { GoalListItem } from '../types'
import * as goalsApi from '../api/goals'

export default function HomePage() {
  const [goals, setGoals] = useState<GoalListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadGoals = useCallback(() => {
    setLoading(true)
    goalsApi.listGoals()
      .then(setGoals)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadGoals() }, [loadGoals])

  const handleDelete = async (e: React.MouseEvent, goalId: string, title: string) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除「${title}」吗？此操作不可恢复。`)) return
    setDeletingId(goalId)
    try {
      await goalsApi.deleteGoal(goalId)
      setGoals(prev => prev.filter(g => g.id !== goalId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // 计算总每日时长
  const totalDailyHours = goals
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + (parseFloat(g.daily_hours) || 0), 0)
  const isOverloaded = totalDailyHours > 8

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">我的目标</h2>
        <Link
          to="/goal/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all"
        >
          ＋ 新建
        </Link>
      </div>

      {/* 每日总时长提示 */}
      {goals.filter(g => g.status === 'active').length > 0 && (
        <div className={`mb-4 px-3 py-2 rounded-xl text-xs flex items-center justify-between ${
          isOverloaded
            ? 'bg-red-50 text-red-600'
            : totalDailyHours > 6
              ? 'bg-yellow-50 text-yellow-600'
              : 'bg-green-50 text-green-600'
        }`}>
          <span>
            📊 {goals.filter(g => g.status === 'active').length} 个活跃目标 ·
            每天共需 <strong>{totalDailyHours.toFixed(1)} 小时</strong>
          </span>
          {isOverloaded && <span>⚠️ 过载</span>}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎯</p>
          <p className="text-gray-500 mb-4">还没有目标，开始你的第一个吧！</p>
          <Link to="/goal/new" className="btn-primary inline-block">
            创建目标
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => (
            <div
              key={goal.id}
              onClick={() => navigate(`/goal/${goal.id}`)}
              className="card cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99] relative group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg pr-8">{goal.title}</h3>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                  goal.status === 'active' ? 'bg-green-100 text-green-700' :
                  goal.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {goal.status === 'active' ? '进行中' :
                   goal.status === 'completed' ? '已完成' :
                   goal.status === 'paused' ? '已暂停' : '已放弃'}
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-2">
                {goal.start_date} ~ {goal.end_date}
              </div>
              <div className="text-xs text-gray-500">
                {goal.goal_type === 'yearly' ? '📅 年度目标' :
                 goal.goal_type === 'monthly' ? '📆 月度目标' : '🎯 自定义目标'}
              </div>
              {/* 删除按钮——hover 时显示 */}
              <button
                onClick={(e) => handleDelete(e, goal.id, goal.title)}
                disabled={deletingId === goal.id}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 text-lg disabled:opacity-50"
                title="删除"
              >
                {deletingId === goal.id ? '⏳' : '🗑'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
