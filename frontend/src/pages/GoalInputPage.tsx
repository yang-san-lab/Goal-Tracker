import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as goalsApi from '../api/goals'
import type { OverloadCheck } from '../types'

function formatHours(h: number): string {
  const hours = Math.floor(h)
  const minutes = Math.round((h - hours) * 60)
  if (hours === 0) return `${minutes} 分钟`
  if (minutes === 0) return `${hours} 小时`
  return `${hours} 小时 ${minutes} 分钟`
}

function formatHoursShort(h: number): string {
  const hours = Math.floor(h)
  const minutes = Math.round((h - hours) * 60)
  if (hours === 0) return `${minutes}分钟`
  if (minutes === 0) return `${hours}h`
  return `${h}h`
}

export default function GoalInputPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goalType, setGoalType] = useState('yearly')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [dailyHours, setDailyHours] = useState(2)
  const [restDaysPerWeek, setRestDaysPerWeek] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overload, setOverload] = useState<OverloadCheck | null>(null)

  // 自动计算结束日期
  const handleGoalTypeChange = (type: string) => {
    setGoalType(type)
    const start = new Date(startDate)
    if (type === 'yearly') {
      start.setFullYear(start.getFullYear() + 1)
    } else if (type === 'monthly') {
      start.setMonth(start.getMonth() + 1)
    }
    setEndDate(start.toISOString().slice(0, 10))
  }

  // 检查过载（dailyHours 变化时触发）
  useEffect(() => {
    const timer = setTimeout(() => {
      goalsApi.checkOverload(dailyHours)
        .then(setOverload)
        .catch(() => setOverload(null))
    }, 500)
    return () => clearTimeout(timer)
  }, [dailyHours])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title || !endDate) return

    setError('')
    setLoading(true)
    try {
      const goal = await goalsApi.createGoal({
        title,
        description,
        goal_type: goalType,
        start_date: startDate,
        end_date: endDate,
        daily_hours: dailyHours,
        rest_days_per_week: restDaysPerWeek,
      })
      navigate(`/goal/${goal.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">创建新目标</h2>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 目标类型 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-2 block">目标类型</label>
          <div className="flex gap-2">
            {[
              { value: 'yearly', label: '📅 年度' },
              { value: 'monthly', label: '📆 月度' },
              { value: 'custom', label: '✨ 自定义' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleGoalTypeChange(value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  goalType === value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 目标标题 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            你的目标是什么？
          </label>
          <input
            className="input"
            type="text"
            placeholder="例：考研上岸 / 减重10公斤 / 读完20本书"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        {/* 详细描述 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            详细描述（可选）
          </label>
          <textarea
            className="input min-h-[100px] resize-none"
            placeholder="描述你的现状、遇到的困难、偏好的学习方式等，帮助 AI 更好地为你规划。&#10;例：我英语基础比较弱，数学还行，工作日每天晚上有3小时，周末全天可用。"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={2000}
          />
        </div>

        {/* 时间范围 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">开始日期</label>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                handleGoalTypeChange(goalType)
              }}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">结束日期</label>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* 每日可用时间 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            每天可用时间：{formatHours(dailyHours)}
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[0.25, 0.5, 1, 2, 3, 4, 6, 8, 10, 12].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setDailyHours(h)}
                className={`text-xs px-2 py-1 rounded-lg transition-all ${
                  dailyHours === h
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {formatHoursShort(h)}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0.25"
            max="12"
            step="0.25"
            value={dailyHours}
            onChange={e => setDailyHours(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>15分钟</span><span>2h</span><span>6h</span><span>12h</span>
          </div>
        </div>

        {/* 每周休息日 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-2 block">
            每周休息几天？
          </label>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRestDaysPerWeek(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  restDaysPerWeek === n
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n === 0 ? '不休' : `${n}天`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {restDaysPerWeek === 0
              ? '每天都有任务安排'
              : `AI 会空出每周 ${restDaysPerWeek} 天不安排任务，自由支配`}
          </p>
        </div>

        {/* 过载警告 */}
        {overload && overload.warning && (
          <div className={`p-3 rounded-xl text-sm ${
            overload.is_overloaded
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
          }`}>
            <p className="flex items-start gap-2">
              <span>{overload.is_overloaded ? '🚨' : '💡'}</span>
              <span>{overload.warning}</span>
            </p>
            <p className="text-xs mt-1 opacity-70">
              当前 {overload.goal_count} 个目标共需 {overload.total_daily_hours} 小时/天
              （建议上限 {overload.threshold} 小时）
            </p>
          </div>
        )}

        {/* 提交 */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              AI 正在拆解你的目标...
            </span>
          ) : (
            '🚀 让 AI 帮我拆解目标'
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          AI 将根据你的目标、时间和描述，自动拆解为月/周/日任务
        </p>
      </form>
    </div>
  )
}
