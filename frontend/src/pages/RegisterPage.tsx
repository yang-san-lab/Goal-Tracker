import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RegisterPage() {
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(username, email, password, 4)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 mb-2">🎯 Goal Tracker</h1>
          <p className="text-gray-500">开始追踪你的目标</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-xl font-semibold text-center">注册</h2>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <input
            className="input"
            type="text"
            placeholder="用户名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
          />
          <input
            className="input"
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="密码（至少6位）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-gray-500">
            已有账号？<Link to="/login" className="text-primary-600 font-medium">登录</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
