import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/', label: '目标', icon: '🎯' },
    { to: '/daily', label: '今日', icon: '📋' },
    { to: '/inbox', label: '收件箱', icon: '📨' },
    { to: '/teams', label: '团队', icon: '👥' },
    { to: '/rewards', label: '奖励', icon: '⭐' },
  ]

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-10">
        <h1 className="text-lg font-bold text-primary-700">Goal Tracker</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-500">
            退出
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* 底部导航栏（移动端） */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-10" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-400'
              }`
            }
          >
            <span className="text-xl">{icon}</span>
            <span className="text-xs">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
