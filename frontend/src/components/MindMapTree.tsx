/** 思维导图树 —— 年目标 → 月里程碑 → 周计划 → 日任务，可折叠展开 */

import { useState, useMemo } from 'react'
import type { Task } from '../types'

interface Props {
  breakdown: any        // AI 拆解的 JSON
  tasks: Task[]         // 数据库中实际的任务（含完成状态）
}

interface TreeNode {
  id: string
  label: string
  subtitle?: string
  level: number
  expanded?: boolean
  completed: number
  total: number
  children: TreeNode[]
}

// 用日期匹配任务状态
function buildTaskStatusMap(tasks: Task[]): Map<string, { completed: number; total: number }> {
  const map = new Map<string, { completed: number; total: number }>()
  // 按日期分组
  const byDate = new Map<string, Task[]>()
  tasks.forEach(t => {
    const key = t.scheduled_date
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(t)
  })
  byDate.forEach((ts, date) => {
    map.set(date, {
      completed: ts.filter(t => t.status === 'completed').length,
      total: ts.length,
    })
  })
  return map
}

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2) // 前两级默认展开
  const hasChildren = node.children.length > 0
  const rate = node.total > 0 ? node.completed / node.total : 0

  const statusColor =
    rate >= 1.0 ? 'bg-green-500' :
    rate > 0 ? 'bg-yellow-400' :
    node.total > 0 ? 'bg-red-300' :
    'bg-gray-200'

  const borderColor =
    rate >= 1.0 ? 'border-green-400' :
    rate > 0 ? 'border-yellow-300' :
    node.total > 0 ? 'border-red-200' :
    'border-gray-200'

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-gray-50 border-l-2 ${borderColor} transition-colors`}
        style={{ marginLeft: depth * 16 }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* 展开/折叠图标 */}
        <span className="text-xs w-4 text-center shrink-0">
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </span>

        {/* 进度小圆点 */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor}`} />

        {/* 标签 */}
        <span className={`text-sm flex-1 truncate ${node.level === 0 ? 'font-bold' : node.level === 1 ? 'font-semibold' : ''}`}>
          {node.label}
        </span>

        {/* 完成数 */}
        {node.total > 0 && (
          <span className={`text-xs shrink-0 ${
            rate >= 1.0 ? 'text-green-600' :
            rate > 0 ? 'text-yellow-600' : 'text-red-400'
          }`}>
            {node.completed}/{node.total}
            <span className="text-gray-300 ml-0.5">({Math.round(rate * 100)}%)</span>
          </span>
        )}

        {/* 副标题 */}
        {node.subtitle && (
          <span className="text-xs text-gray-400 truncate hidden sm:inline">{node.subtitle}</span>
        )}
      </div>

      {/* 子节点 */}
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MindMapTree({ breakdown, tasks }: Props) {
  const taskStatusMap = useMemo(() => buildTaskStatusMap(tasks), [tasks])

  const tree = useMemo(() => {
    const root: TreeNode = {
      id: 'root',
      label: breakdown?.restated_goal || breakdown?.yearly_goal || '目标',
      level: 0,
      completed: 0,
      total: 0,
      children: [],
    }

    const milestones = breakdown?.milestones || []
    milestones.forEach((ms: any, mi: number) => {
      const monthNode: TreeNode = {
        id: `m-${mi}`,
        label: `${ms.month} · ${ms.theme}`,
        subtitle: ms.goal,
        level: 1,
        completed: 0,
        total: 0,
        children: [],
      }

      const weeks = ms.weekly_goals || []
      weeks.forEach((wk: any, wi: number) => {
        const weekNode: TreeNode = {
          id: `m-${mi}-w-${wi}`,
          label: `第${wk.week_number || wi + 1}周 · ${wk.theme || ''}`,
          subtitle: `${wk.start_date || ''} ~ ${wk.end_date || ''}`,
          level: 2,
          completed: 0,
          total: 0,
          children: [],
        }

        const days = wk.daily_tasks || []
        days.forEach((day: any, di: number) => {
          const dateStr = day.date || ''
          const status = taskStatusMap.get(dateStr) || { completed: 0, total: day.tasks?.length || 0 }

          const dayNode: TreeNode = {
            id: `m-${mi}-w-${wi}-d-${di}`,
            label: `${dateStr} ${day.day_of_week || ''}`.trim(),
            level: 3,
            completed: status.completed,
            total: status.total,
            children: [],
          }

          // 任务级别
          const tasksList = day.tasks || []
          tasksList.forEach((t: any, ti: number) => {
            dayNode.children.push({
              id: `m-${mi}-w-${wi}-d-${di}-t-${ti}`,
              label: `📌 ${t.title}`,
              subtitle: `${t.duration_min || '?'}分钟 · 优先级${t.priority || '-'}`,
              level: 4,
              completed: 0,
              total: 0,
              children: [],
            })
          })

          // 汇总
          dayNode.completed = dayNode.children.filter(c => c.total > 0).length || status.completed
          dayNode.total = dayNode.children.length || status.total
          weekNode.completed += dayNode.completed
          weekNode.total += dayNode.total
          weekNode.children.push(dayNode)
        })

        monthNode.completed += weekNode.completed
        monthNode.total += weekNode.total
        monthNode.children.push(weekNode)
      })

      root.completed += monthNode.completed
      root.total += monthNode.total
      root.children.push(monthNode)
    })

    return root
  }, [breakdown, taskStatusMap])

  const rootRate = root.total > 0 ? Math.round(root.completed / root.total * 100) : 0

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">🧠 目标导图</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          rootRate >= 80 ? 'bg-green-100 text-green-700' :
          rootRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
          rootRate > 0 ? 'bg-red-100 text-red-600' :
          'bg-gray-100 text-gray-500'
        }`}>
          总进度 {rootRate}%
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-0.5">
        {tree.children.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">暂无拆解数据</p>
        ) : (
          tree.children.map(child => (
            <TreeNodeRow key={child.id} node={child} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
