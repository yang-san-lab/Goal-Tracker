import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Goal, GoalProgress, Task, TeamItem } from '../types'
import * as goalsApi from '../api/goals'
import * as teamsApi from '../api/teams'
import MindMapTree from '../components/MindMapTree'
import HeatmapCalendar from '../components/HeatmapCalendar'
import StatsPanel from '../components/StatsPanel'
import ChatPanel from '../components/ChatPanel'

export default function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>()
  const navigate = useNavigate()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [progress, setProgress] = useState<GoalProgress | null>(null)
  const [calendarData, setCalendarData] = useState<any>(null)
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'mindmap' | 'calendar' | 'stats' | 'chat' | 'assign'>('mindmap')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 团队分配相关
  const [teams, setTeams] = useState<TeamItem[]>([])
  const [captainTeams, setCaptainTeams] = useState<TeamItem[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, { user_id: string; username: string }[]>>({})
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null)
  const [errorAssign, setErrorAssign] = useState('')

  const loadData = async () => {
    if (!goalId) return
    setLoading(true)
    try {
      const [g, p, cal] = await Promise.all([
        goalsApi.getGoal(goalId),
        goalsApi.getGoalProgress(goalId),
        goalsApi.getGoalCalendar(goalId).catch(() => null),
      ])
      setGoal(g)
      setProgress(p)
      setCalendarData(cal)

      // 加载目标下所有任务（用于导图状态匹配）
      try {
        const goalTasks = await goalsApi.getGoalTasks(goalId)
        setAllTasks(goalTasks)
      } catch {
        setAllTasks([])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // 加载用户团队
  const loadTeams = async () => {
    try {
      const data = await teamsApi.listTeams()
      setTeams(data)
      const captains = data.filter(t => t.user_role === 'captain')
      setCaptainTeams(captains)
      // 预加载所有队长团队的成员
      const membersMap: Record<string, { user_id: string; username: string }[]> = {}
      for (const t of captains) {
        try {
          const detail = await teamsApi.getTeamDetail(t.id)
          membersMap[t.id] = detail.members
            .filter(m => m.status === 'active' && m.role !== 'captain')
            .map(m => ({ user_id: m.user_id, username: m.username }))
        } catch { /* skip */ }
      }
      setTeamMembers(membersMap)
    } catch { /* 静默失败 */ }
  }

  useEffect(() => { loadData(); loadTeams() }, [goalId])

  const handleAdjust = async () => {
    if (!goalId) return
    setAdjusting(true)
    setError('')
    try {
      const result = await goalsApi.triggerAdjustment(goalId, 'user_request')
      alert(`✅ AI 调整完成！\n\n${result.message}\n\n调整了 ${result.adjustments_made.length} 项任务。\n请刷新页面查看最新安排。`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdjusting(false)
    }
  }

  const handleAssign = async (taskId: string, teamId: string, assigneeId: string) => {
    if (!assigneeId) return
    setAssigningTaskId(taskId)
    setErrorAssign('')
    try {
      await teamsApi.assignTask(teamId, taskId, assigneeId)
      // 刷新任务列表
      await loadData()
      setAssigningTaskId(null)
    } catch (err: any) {
      setErrorAssign(err.message)
      setAssigningTaskId(null)
    }
  }

  const handleDelete = async () => {
    if (!goalId) return
    setDeleting(true)
    try {
      await goalsApi.deleteGoal(goalId)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message)
      setDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!goal) {
    return <div className="px-4 py-20 text-center text-gray-500">目标不存在</div>
  }

  const breakdown = goal.ai_breakdown

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* 返回 */}
      <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
        ← 返回列表
      </button>

      {/* 目标概览 */}
      <div className="card mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{goal.title}</h2>
            {goal.description && <p className="text-gray-500 text-sm mb-2">{goal.description}</p>}
            <div className="flex gap-4 text-xs text-gray-400">
              <span>{goal.start_date} ~ {goal.end_date}</span>
              <span>每天 {goal.daily_hours}h</span>
            </div>
          </div>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-gray-300 hover:text-red-500 text-xl shrink-0 transition-colors"
            title="删除目标"
          >
            🗑️
          </button>
        </div>

        {/* 进度条 */}
        {progress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>进度 {Math.round(progress.completion_rate * 100)}%</span>
              <span>✅{progress.completed} ⏸{progress.delayed} 📋{progress.pending}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${Math.round(progress.completion_rate * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'mindmap', label: '🧠 导图' },
          { key: 'calendar', label: '📅 日历' },
          { key: 'stats', label: '📊 分析' },
          { key: 'chat', label: '💬 AI 教练' },
          ...(captainTeams.length > 0 ? [{ key: 'assign' as const, label: '👥 分配' }] : []),
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {tab === 'mindmap' && (
        <MindMapTree
          breakdown={breakdown}
          tasks={allTasks}
        />
      )}

      {tab === 'calendar' && calendarData && (
        <HeatmapCalendar
          data={calendarData.calendar}
          startDate={goal.start_date}
          endDate={goal.end_date}
        />
      )}

      {tab === 'stats' && calendarData && (
        <StatsPanel
          calendarData={calendarData.calendar}
          goalStartDate={goal.start_date}
          goalEndDate={goal.end_date}
          totalTasks={calendarData.summary.total_tasks}
          completedTasks={calendarData.summary.completed_tasks}
          completionRate={calendarData.summary.completion_rate}
        />
      )}

      {tab === 'chat' && goalId && (
        <ChatPanel goalId={goalId} />
      )}

      {/* 团队分配 Tab（仅队长可见） */}
      {tab === 'assign' && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500 mb-2">
            选择任务并分配给团队成员。已分配的任务会出现在成员的收件箱中。
          </div>
          {errorAssign && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{errorAssign}</div>
          )}

          {allTasks.filter(t => t.status === 'pending').length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>没有可分配的任务</p>
              <p className="text-sm mt-1">AI 拆解后的待处理任务会显示在这里</p>
            </div>
          ) : (
            allTasks
              .filter(t => t.status === 'pending')
              .map(task => (
                <div key={task.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800">{task.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        📅 {task.scheduled_date} · ⏱ {task.duration_minutes}分 · {task.category}
                      </p>
                      {task.assignment_type === 'assigned' && (
                        <p className="text-xs mt-1">
                          {task.assignment_status === 'accepted' ? (
                            <span className="text-green-600">
                              ✅ 已由 {task.assignee_name || task.assigned_to} 接受
                            </span>
                          ) : task.assignment_status === 'pending_accept' ? (
                            <span className="text-yellow-600">
                              ⏳ 等待 {task.assignee_name || task.assigned_to} 接受
                            </span>
                          ) : task.assignment_status === 'rejected' ? (
                            <span className="text-red-400">
                              ❌ 已被拒绝
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>

                    {/* 分配操作（未分配或已拒绝的任务） */}
                    {(!task.assignment_type || task.assignment_type === 'own' || task.assignment_status === 'rejected') && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          onChange={(e) => {
                            const [teamId, memberId] = e.target.value.split('|')
                            if (teamId && memberId) {
                              handleAssign(task.id, teamId, memberId)
                              e.target.value = ''
                            }
                          }}
                          value=""
                          disabled={assigningTaskId === task.id}
                        >
                          <option value="">分配至...</option>
                          {captainTeams.map(team => {
                            const members = teamMembers[team.id] || []
                            return (
                              <optgroup key={team.id} label={`👥 ${team.name}`}>
                                {members.length === 0 ? (
                                  <option value="" disabled>暂无成员</option>
                                ) : (
                                  members.map(m => (
                                    <option key={m.user_id} value={`${team.id}|${m.user_id}`}>
                                      {m.username}
                                    </option>
                                  ))
                                )}
                              </optgroup>
                            )
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* AI 分析 */}
      {breakdown?.analysis && (
        <div className="card mt-4 bg-blue-50 border-blue-100">
          <p className="text-xs font-medium text-blue-800 mb-1">🤖 AI 分析</p>
          <p className="text-sm text-blue-700">{breakdown.analysis}</p>
          {breakdown.tips && (
            <ul className="mt-2 text-xs text-blue-600 space-y-0.5">
              {breakdown.tips.map((tip: string, i: number) => (
                <li key={i}>💡 {tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-4">
        <button onClick={() => navigate('/daily')} className="btn-primary flex-1 text-center">
          📋 今日任务
        </button>
        <button onClick={handleAdjust} disabled={adjusting} className="btn-outline flex-1">
          {adjusting ? '调整中...' : '🔄 AI 重规划'}
        </button>
      </div>

      {error && <div className="mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">删除目标</h3>
            <p className="text-gray-500 text-sm mb-4">
              确定要删除「{goal.title}」吗？所有关联的任务和记录都会被删除，此操作不可恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
