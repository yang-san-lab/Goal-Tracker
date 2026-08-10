import { useState, useEffect, FormEvent } from 'react'
import type { PointsBalance, PointTransactionItem, CustomRewardItem } from '../types'
import * as rewardsApi from '../api/rewards'

const ICONS = ['🎁', '🎮', '🍿', '🎵', '📚', '✈️', '🛍️', '🍔']

const TYPE_LABELS: Record<string, string> = {
  task_complete: '✅ 任务完成',
  streak_bonus: '🔥 连续打卡',
  milestone: '🏅 里程碑',
  penalty: '⚠️ 惩罚',
  redeem: '🎁 兑换奖励',
}

export default function RewardsPage() {
  const [balance, setBalance] = useState<PointsBalance | null>(null)
  const [transactions, setTransactions] = useState<PointTransactionItem[]>([])
  const [rewards, setRewards] = useState<CustomRewardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 添加/编辑表单
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCost, setFormCost] = useState('50')
  const [formDesc, setFormDesc] = useState('')
  const [formIcon, setFormIcon] = useState('🎁')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // 兑换状态
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [bal, txs, rws] = await Promise.all([
        rewardsApi.getBalance().catch(() => ({ balance: 0, total_earned: 0 })),
        rewardsApi.getTransactions().catch(() => []),
        rewardsApi.listRewards().catch(() => []),
      ])
      setBalance(bal)
      setTransactions(txs)
      setRewards(rws)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // 打开添加表单
  const openAddForm = () => {
    setEditingId(null)
    setFormName('')
    setFormCost('50')
    setFormDesc('')
    setFormIcon('🎁')
    setShowForm(true)
  }

  // 打开编辑表单
  const openEditForm = (r: CustomRewardItem) => {
    setEditingId(r.id)
    setFormName(r.name)
    setFormCost(String(r.star_cost))
    setFormDesc(r.description)
    setFormIcon(r.icon)
    setShowForm(true)
  }

  // 提交表单
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const cost = parseInt(formCost, 10)
    if (!formName.trim() || !Number.isFinite(cost) || cost <= 0) return
    setFormSubmitting(true)
    setError('')
    try {
      if (editingId) {
        await rewardsApi.updateReward(editingId, {
          name: formName.trim(),
          star_cost: cost,
          description: formDesc,
          icon: formIcon,
        })
      } else {
        await rewardsApi.createReward({
          name: formName.trim(),
          star_cost: cost,
          description: formDesc,
          icon: formIcon,
        })
      }
      setShowForm(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  // 删除奖励
  const handleDelete = async (rewardId: string) => {
    if (!window.confirm('确定删除这个奖励吗？')) return
    try {
      await rewardsApi.deleteReward(rewardId)
      setRewards(prev => prev.filter(r => r.id !== rewardId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  // 兑换
  const handleRedeem = async (reward: CustomRewardItem) => {
    if (!balance || balance.balance < reward.star_cost) return
    setRedeemingId(reward.id)
    setError('')
    setSuccess('')
    try {
      const result = await rewardsApi.redeemReward(reward.id)
      setSuccess(result.message)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRedeemingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* 星星余额卡片 */}
      <div className="card mb-4 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 text-center">
        <p className="text-4xl mb-1">⭐</p>
        <p className="text-3xl font-bold text-yellow-700">{balance?.balance ?? 0}</p>
        <p className="text-xs text-yellow-500 mt-1">
          累计获得 {balance?.total_earned ?? 0}⭐
        </p>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-center justify-between">
          <span>🎉 {success}</span>
          <button onClick={() => setSuccess('')} className="text-green-400">✕</button>
        </div>
      )}

      {/* 我的奖励 */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">🎁 我的奖励</h3>
          <button
            onClick={openAddForm}
            className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            ＋ 添加
          </button>
        </div>

        {rewards.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            还没有奖励，点击"添加"来设置你想兑换的东西
          </p>
        ) : (
          <div className="space-y-2">
            {rewards.map(r => {
              const canAfford = (balance?.balance ?? 0) >= r.star_cost
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl shrink-0">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-gray-400 truncate">{r.description}</p>
                    )}
                    <p className="text-xs text-yellow-600 mt-0.5">{r.star_cost} ⭐</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEditForm(r)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1"
                    >
                      🗑
                    </button>
                    <button
                      onClick={() => handleRedeem(r)}
                      disabled={!canAfford || redeemingId === r.id}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        canAfford
                          ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {redeemingId === r.id ? '...' : '兑换'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 添加/编辑表单 */}
        {showForm && (
          <form onSubmit={handleFormSubmit} className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <p className="text-sm font-medium">{editingId ? '编辑奖励' : '添加奖励'}</p>
            <input
              className="input text-sm"
              placeholder="奖励名称（如：看一场电影）"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
              maxLength={100}
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400">所需星星</label>
                <input
                  className="input text-sm"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={formCost}
                  onChange={e => setFormCost(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">图标</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormIcon(icon)}
                      className={`text-lg p-1 rounded-lg ${formIcon === icon ? 'bg-primary-100 ring-2 ring-primary-400' : ''}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <input
              className="input text-sm"
              placeholder="描述（可选）"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={formSubmitting}
                className="flex-1 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {formSubmitting ? '保存...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-xl text-sm font-medium"
              >
                取消
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 积分流水 */}
      <div className="card">
        <h3 className="font-semibold mb-3">📋 积分流水</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">暂无记录</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-gray-600">
                    {TYPE_LABELS[tx.type] || tx.type}
                  </span>
                  {tx.source_task_id && tx.type === 'redeem' && (
                    <span className="text-gray-400 text-xs ml-1">· {tx.source_task_id}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}⭐
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(tx.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
