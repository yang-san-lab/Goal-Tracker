import { useState, useEffect, useRef, FormEvent } from 'react'
import type { ChatMessage } from '../types'
import * as goalsApi from '../api/goals'

interface Props {
  goalId: string
}

export default function ChatPanel({ goalId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 加载历史消息
  useEffect(() => {
    setLoadingHistory(true)
    goalsApi.getChatHistory(goalId)
      .then(setMessages)
      .catch(e => setError(e.message))
      .finally(() => setLoadingHistory(false))
  }, [goalId])

  // 新消息时自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setError('')
    setSending(true)

    // 乐观添加用户消息
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      goal_id: goalId,
      role: 'user',
      content: text,
      suggested_adjustments: null,
      applied: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const aiMsg = await goalsApi.sendChatMessage(goalId, text)
      // 替换临时用户消息为真实的（用服务端 ID），并追加 AI 回复
      setMessages(prev => [
        ...prev.filter(m => m.id !== userMsg.id),
        { ...userMsg, id: aiMsg.id + '_user' }, // 占位，不影响功能
        aiMsg,
      ])
    } catch (err: any) {
      setError(err.message)
      // 保留用户消息但标记发送失败
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // 应用调整建议
  const handleApply = async (msgId: string) => {
    setApplyingId(msgId)
    setError('')
    try {
      const result = await goalsApi.applyChatAdjustment(goalId, msgId)
      // 标记该消息已应用
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId ? { ...m, applied: true } : m
        )
      )
      // 显示简短成功提示
      const count = result.adjustments_count
      setError(`✅ 已应用 ${count} 项调整，请刷新查看最新安排`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplyingId(null)
    }
  }

  // Enter 发送，Shift+Enter 换行
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
      {/* 错误/成功提示 */}
      {error && (
        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs mb-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-blue-400 ml-2">✕</button>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {loadingHistory ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">开始和 AI 教练聊聊你的目标吧！</p>
            <p className="text-xs mt-1">你可以说说你的进度、遇到的困难，或者需要调整的地方</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {/* AI 回复支持简单换行渲染 */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* 调整建议按钮（仅 AI 消息、有未应用建议） */}
                {msg.role === 'ai' &&
                  msg.suggested_adjustments &&
                  msg.suggested_adjustments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        💡 建议调整 {msg.suggested_adjustments.length} 项任务：
                      </p>
                      <ul className="text-xs text-gray-500 space-y-1 mb-3">
                        {msg.suggested_adjustments.map((adj, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="shrink-0">•</span>
                            <span>
                              <strong>{adj.task_title}</strong>
                              <br />
                              → {adj.new_date}（{adj.reason}）
                            </span>
                          </li>
                        ))}
                      </ul>
                      {msg.applied ? (
                        <span className="text-xs text-green-600 font-medium">✅ 已应用</span>
                      ) : (
                        <button
                          onClick={() => handleApply(msg.id)}
                          disabled={applyingId === msg.id}
                          className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          {applyingId === msg.id ? '应用...' : '📋 应用调整'}
                        </button>
                      )}
                    </div>
                  )}

                {/* 时间戳 */}
                <div className={`text-[10px] mt-1 ${
                  msg.role === 'user' ? 'text-white/60' : 'text-gray-400'
                }`}>
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        )}

        {/* 发送中指示器 */}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSend} className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说说你的情况..."
          rows={2}
          maxLength={2000}
          disabled={sending}
          className="flex-1 resize-none input text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 transition-all shrink-0"
        >
          发送
        </button>
      </form>
    </div>
  )
}
