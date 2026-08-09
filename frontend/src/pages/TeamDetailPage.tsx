import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import * as teamsApi from '../api/teams'
import type { TeamDetail, Task } from '../types'

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamTasks, setTeamTasks] = useState<Task[]>([])
  const [tab, setTab] = useState<'members' | 'tasks'>('members')

  const isCaptain = team?.captain_id === user?.id

  const loadTeam = useCallback(async () => {
    if (!teamId) return
    try {
      const data = await teamsApi.getTeamDetail(teamId)
      setTeam(data)
      if (data.user_role === 'captain') {
        const tasks = await teamsApi.getTeamTasks(teamId)
        setTeamTasks(tasks)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { loadTeam() }, [loadTeam])

  const handleRemoveMember = async (memberUserId: string) => {
    if (!teamId || !window.confirm('确定要移除该成员吗？')) return
    try {
      await teamsApi.removeMember(teamId, memberUserId)
      await loadTeam()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLeaveTeam = async () => {
    if (!teamId || !window.confirm('确定要退出团队吗？')) return
    try {
      await teamsApi.leaveTeam(teamId)
      navigate('/teams', { replace: true })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const copyInviteCode = () => {
    if (team) {
      navigator.clipboard.writeText(team.invite_code)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">团队不存在</p>
      </div>
    )
  }

  const statusLabels: Record<string, string> = {
    pending_accept: '待接受',
    accepted: '已接受',
    rejected: '已拒绝',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => navigate('/teams')} className="text-sm text-gray-400 hover:text-gray-600 mb-4">
        ← 返回团队列表
      </button>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {/* 团队信息 */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-800">{team.name}</h1>
          {isCaptain && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">👑 队长</span>}
        </div>
        {team.description && <p className="text-sm text-gray-500 mb-3">{team.description}</p>}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">{team.member_count} 位成员</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">邀请码:</span>
          <code className="bg-gray-100 px-2 py-0.5 rounded text-lg font-mono tracking-wider">
            {team.invite_code}
          </code>
          <button
            onClick={copyInviteCode}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            复制
          </button>
        </div>
        {!isCaptain && (
          <button
            onClick={handleLeaveTeam}
            className="mt-3 text-sm text-red-400 hover:text-red-600"
          >
            退出团队
          </button>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('members')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          成员 ({team.member_count})
        </button>
        {isCaptain && (
          <button
            onClick={() => setTab('tasks')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'tasks'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            已分配任务 ({teamTasks.length})
          </button>
        )}
      </div>

      {/* 成员列表 */}
      {tab === 'members' && (
        <div className="space-y-2">
          {team.members.map(member => (
            <div
              key={member.id}
              className="card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                  👤
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">
                    {member.username}
                    {member.user_id === team.captain_id && (
                      <span className="ml-2 text-xs text-yellow-600">👑</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {member.role === 'captain' ? '队长' : '成员'}
                  </p>
                </div>
              </div>
              {isCaptain && member.user_id !== user?.id && (
                <button
                  onClick={() => handleRemoveMember(member.user_id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                >
                  移除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 已分配任务列表（队长视角） */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {teamTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>还没有分配过任务</p>
              <p className="text-sm mt-1">在目标详情页中将任务分配给团队成员</p>
            </div>
          ) : (
            teamTasks.map(task => (
              <div key={task.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      🎯 {task.goal_title} · 📅 {task.scheduled_date} · ⏱ {task.duration_minutes}分
                    </p>
                    <p className="text-xs text-gray-400">
                      分配给: {task.assignee_name || task.assigned_to}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    task.assignment_status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : task.assignment_status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {statusLabels[task.assignment_status || ''] || task.assignment_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
