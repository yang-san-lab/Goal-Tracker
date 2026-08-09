/** GitHub 风格的日历热力图 —— 一目了然看到每天完成情况 */

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
  data: CalendarDay[]
  startDate: string
  endDate: string
}

// 完成率 → 颜色深度
function colorForRate(rate: number, hasTasks: boolean): string {
  if (!hasTasks) return 'bg-gray-100'        // 没有任务
  if (rate >= 1.0) return 'bg-green-500'      // 100%
  if (rate >= 0.75) return 'bg-green-400'
  if (rate >= 0.5) return 'bg-green-300'
  if (rate >= 0.25) return 'bg-yellow-300'
  return 'bg-red-300'                         // < 25%
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function HeatmapCalendar({ data, startDate, endDate }: Props) {
  // 构建日期→数据映射
  const dateMap = useMemo(() => {
    const map: Record<string, CalendarDay> = {}
    data.forEach(d => { map[d.date] = d })
    return map
  }, [data])

  // 生成所有日期格子
  const weeks = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const result: { date: string; day: CalendarDay | null; hasTasks: boolean }[][] = []

    // 对齐到周一
    const cursor = new Date(start)
    cursor.setDate(cursor.getDate() - cursor.getDay() + 1) // 周一

    let currentWeek: any[] = []
    while (cursor <= end || currentWeek.length > 0) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const day = dateMap[dateStr] || null
      const hasTasks = day !== null && day.total > 0
      const inRange = cursor >= start && cursor <= end

      currentWeek.push({
        date: dateStr,
        day: inRange ? day : null,
        hasTasks: inRange && hasTasks,
        inRange,
      })

      if (cursor.getDay() === 0) { // 周日，新起一周
        result.push(currentWeek)
        currentWeek = []
      }

      cursor.setDate(cursor.getDate() + 1)

      // 安全上限
      if (result.length > 52) break
    }

    if (currentWeek.length > 0) result.push(currentWeek)
    return result
  }, [dateMap, startDate, endDate])

  const totalDays = data.length
  const perfectDays = data.filter(d => d.rate >= 1.0).length
  const zeroDays = data.filter(d => d.rate === 0 && d.total > 0).length

  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-3">📅 日历热力图</h3>

      {/* 图例 */}
      <div className="flex items-center gap-1 mb-3 text-xs text-gray-400">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100" />
        <div className="w-3 h-3 rounded-sm bg-red-300" />
        <div className="w-3 h-3 rounded-sm bg-yellow-300" />
        <div className="w-3 h-3 rounded-sm bg-green-300" />
        <div className="w-3 h-3 rounded-sm bg-green-400" />
        <div className="w-3 h-3 rounded-sm bg-green-500" />
        <span>多</span>
      </div>

      {/* 格子矩阵 */}
      <div className="overflow-x-auto">
        <div className="flex gap-0.5" style={{ minWidth: weeks.length * 14 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day: any) => (
                <div
                  key={day.date}
                  title={`${formatDateLabel(day.date)}: ${day.day ? Math.round(day.day.rate * 100) + '%' : '-'}`}
                  className={`w-3.5 h-3.5 rounded-sm ${
                    !day.inRange
                      ? 'bg-transparent'
                      : colorForRate(day.day?.rate ?? 0, day.hasTasks)
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 统计数字 */}
      <div className="flex justify-between text-xs text-gray-400 mt-3">
        <span>{totalDays} 天有任务</span>
        <span className="text-green-500">{perfectDays} 天全勤</span>
        <span className="text-red-400">{zeroDays} 天空白</span>
      </div>
    </div>
  )
}
