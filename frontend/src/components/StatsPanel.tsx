/** 统计面板 —— 完成率趋势、预估完成日期、延期预警 */

import { useMemo } from 'react'

interface CalendarDay {
  date: string
  total: number
  completed: number
  delayed: number
  skipped: number
  rate: number
}

interface Props {
  calendarData: CalendarDay[]
  goalStartDate: string
  goalEndDate: string
  totalTasks: number
  completedTasks: number
  completionRate: number
}

export default function StatsPanel({
  calendarData,
  goalStartDate,
  goalEndDate,
  totalTasks,
  completedTasks,
  completionRate: overallRate,
}: Props) {
  const stats = useMemo(() => {
    // ── 近期14天数据（所有有任务的天数，包括完成率0%的）──
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // 取最近14天（按日历日期，不管有没有任务）
    const recent14: CalendarDay[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const found = calendarData.find(c => c.date === dateStr)
      recent14.push(found || { date: dateStr, total: 0, completed: 0, delayed: 0, skipped: 0, rate: 0 })
    }

    // 有任务的天数
    const activeDays = recent14.filter(d => d.total > 0)
    const activeDayCount = activeDays.length

    // 近期日均完成率（有任务的天）
    const recentAvgRate = activeDayCount > 0
      ? activeDays.reduce((s, d) => s + d.rate, 0) / activeDayCount
      : overallRate

    // 近期日均完成任务数
    const totalCompletedRecent = activeDays.reduce((s, d) => s + d.completed, 0)
    const tasksPerDay = activeDayCount > 0
      ? totalCompletedRecent / activeDayCount
      : completedTasks / Math.max(1, calendarData.filter(d => d.total > 0).length)

    // 趋势方向（最近3个有任务的天）
    const recentActive = activeDays.filter(d => d.total > 0).slice(-3)
    const trendDir = recentActive.length >= 2
      ? (recentActive[recentActive.length - 1].rate > recentActive[0].rate ? 'up' :
         recentActive[recentActive.length - 1].rate < recentActive[0].rate ? 'down' : 'flat')
      : 'flat'

    // ── 预估完成日期 ──
    const endDate = new Date(goalEndDate + 'T00:00:00')
    const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000))
    const remainingTasks = totalTasks - completedTasks

    // 按每日实际完成任务数来预估
    const pace = tasksPerDay > 0 ? tasksPerDay : 0.5  // 每天完成 N 个任务
    const daysNeeded = pace > 0 ? Math.ceil(remainingTasks / pace) : 999
    const estimatedExtraDays = daysNeeded - remainingDays

    // ── 连续打卡天数 ──
    // 从今天往回数，连续有完成任务的 days
    let streak = 0
    for (let i = recent14.length - 1; i >= 0; i--) {
      if (recent14[i].completed > 0) streak++
      else break
    }

    // ── 连续全勤天数（完成率100%）──
    let perfectStreak = 0
    for (let i = recent14.length - 1; i >= 0; i--) {
      if (recent14[i].total > 0 && recent14[i].rate >= 1.0) perfectStreak++
      else break
    }

    return {
      recentAvgRate, tasksPerDay, trendDir,
      remainingDays, remainingTasks,
      daysNeeded, estimatedExtraDays,
      streak, perfectStreak, activeDayCount,
    }
  }, [calendarData, overallRate, totalTasks, completedTasks, goalEndDate])

  const ratePct = Math.round(overallRate * 100)
  const recentRatePct = Math.round(stats.recentAvgRate * 100)
  const extraDays = Math.max(0, stats.estimatedExtraDays)

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-sm">📊 可行性分析</h3>

      {/* 三个指标卡片 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center bg-blue-50 rounded-xl p-3">
          <p className="text-2xl font-bold text-blue-700">{ratePct}%</p>
          <p className="text-xs text-blue-500">总完成率</p>
        </div>
        <div className="text-center bg-green-50 rounded-xl p-3">
          <p className="text-2xl font-bold text-green-700">{recentRatePct}%</p>
          <p className="text-xs text-green-500">近期日均完成率</p>
        </div>
        <div className="text-center bg-purple-50 rounded-xl p-3">
          <p className="text-2xl font-bold text-purple-700">{stats.streak}</p>
          <p className="text-xs text-purple-500">连续打卡天数</p>
        </div>
      </div>

      {/* 第二行：每日节奏 + 全勤 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center bg-amber-50 rounded-xl p-2">
          <p className="text-lg font-bold text-amber-700">{stats.tasksPerDay.toFixed(1)}</p>
          <p className="text-xs text-amber-500">日均完成任务</p>
        </div>
        <div className="text-center bg-teal-50 rounded-xl p-2">
          <p className="text-lg font-bold text-teal-700">{stats.perfectStreak}</p>
          <p className="text-xs text-teal-500">连续全勤天数</p>
        </div>
      </div>

      {/* 趋势指示 */}
      <div className="flex items-center gap-2 text-sm">
        <span>📈 近期趋势：</span>
        {stats.trendDir === 'up' ? (
          <span className="text-green-600 font-medium">上升 ↑ 继续保持！</span>
        ) : stats.trendDir === 'down' ? (
          <span className="text-red-500 font-medium">下降 ↓ 需要调整</span>
        ) : (
          <span className="text-gray-500">平稳</span>
        )}
      </div>

      {/* 预估完成 */}
      <div className={`p-3 rounded-xl text-sm ${
        extraDays <= 0 ? 'bg-green-50 text-green-700' :
        extraDays <= 7 ? 'bg-yellow-50 text-yellow-700' :
        'bg-red-50 text-red-700'
      }`}>
        {extraDays <= 0 ? (
          <p>✅ 按当前节奏 <strong>可以按时</strong>完成目标</p>
        ) : (
          <p>
            {extraDays <= 7 ? '⚠️' : '🚨'} 按当前节奏（日均完成 {stats.tasksPerDay.toFixed(1)} 个任务），
            还需要 <strong>{stats.daysNeeded}</strong> 天，预计延期 <strong>{extraDays}</strong> 天
          </p>
        )}
        <p className="text-xs mt-1 opacity-70">
          剩余 {stats.remainingTasks} 个任务 · 剩余 {stats.remainingDays} 天 ·
          需日均完成 {(stats.remainingTasks / Math.max(stats.remainingDays, 1)).toFixed(1)} 个
        </p>
      </div>

      {/* 进度 vs 时间双轨对比 */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>任务完成进度</span>
          <span>时间流逝进度</span>
        </div>
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          {(() => {
            const start = new Date(goalStartDate + 'T00:00:00')
            const end = new Date(goalEndDate + 'T00:00:00')
            const now = new Date()
            const totalSpan = end.getTime() - start.getTime()
            const timePct = totalSpan > 0
              ? Math.min(100, Math.round((now.getTime() - start.getTime()) / totalSpan * 100))
              : 0
            return (
              <div
                className="absolute top-0 left-0 h-full bg-gray-300 opacity-50 rounded-full"
                style={{ width: `${timePct}%` }}
              />
            )
          })()}
          <div
            className="absolute top-0 left-0 h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${ratePct}%` }}
          />
        </div>
        {ratePct < (() => {
          const start = new Date(goalStartDate + 'T00:00:00')
          const end = new Date(goalEndDate + 'T00:00:00')
          const now = new Date()
          const totalSpan = end.getTime() - start.getTime()
          return totalSpan > 0
            ? Math.round((now.getTime() - start.getTime()) / totalSpan * 100)
            : 0
        })() && (
          <p className="text-xs text-red-400 mt-1">⚠ 任务进度落后于时间流逝</p>
        )}
      </div>
    </div>
  )
}
