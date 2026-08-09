import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as teamsApi from '../api/teams'
import type { TeamItem } from '../types'

export default function TeamsPage() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<TeamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      const data = await teamsApi.listTeams()
      setTeams(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTeams() }, [loadTeams])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSubmitting(true)
    try {
      await teamsApi.createTeam({ name: newName.trim(), description: newDesc.trim() })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      await loadTeams()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setSubmitting(true)
    try {
      await teamsApi.joinTeam(inviteCode.trim())
      setShowJoin(false)
      setInviteCode('')
      await loadTeams()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
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
        <h1 className="text-2xl font-bold text-gray-800">👥 我的团队</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setError('') }}
            className="text-sm px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50"
          >
            加入团队
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); setError('') }}
            className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            创建团队
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {/* 创建团队表单 */}
      {showCreate && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-semibold text-gray-700">创建新团队</h3>
          <input
            className="input"
            placeholder="团队名称"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={100}
          />
          <input
            className="input"
            placeholder="团队描述（选填）"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            maxLength={500}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting || !newName.trim()}
              className="btn-primary text-sm"
            >
              {submitting ? '创建中...' : '确认创建'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 加入团队表单 */}
      {showJoin && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-semibold text-gray-700">加入团队</h3>
          <p className="text-sm text-gray-400">输入队长分享的6位邀请码</p>
          <input
            className="input text-center text-2xl tracking-widest"
            placeholder="000000"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
          />
          <div className="flex gap-2">
            <button
              onClick={handleJoin}
              disabled={submitting || inviteCode.length < 6}
              className="btn-primary text-sm"
            >
              {submitting ? '加入中...' : '确认加入'}
            </button>
            <button
              onClick={() => setShowJoin(false)}
              className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 团队列表 */}
      {teams.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">👥</p>
          <p className="text-lg mb-2">还没有加入任何团队</p>
          <p className="text-sm">创建一个团队或输入邀请码加入</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div
              key={team.id}
              onClick={() => navigate(`/teams/${team.id}`)}
              className="card cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{team.name}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {team.member_count} 位成员 · 邀请码: {team.invite_code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {team.user_role === 'captain' && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">👑 队长</span>
                  )}
                  <span className="text-gray-300 text-xl">›</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
