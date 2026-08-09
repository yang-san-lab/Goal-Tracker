import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import GoalInputPage from './pages/GoalInputPage'
import GoalDetailPage from './pages/GoalDetailPage'
import DailyViewPage from './pages/DailyViewPage'
import RewardsPage from './pages/RewardsPage'
import TeamsPage from './pages/TeamsPage'
import TeamDetailPage from './pages/TeamDetailPage'
import TaskInboxPage from './pages/TaskInboxPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login" element={auth.user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={auth.user ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="goal/new" element={<GoalInputPage />} />
          <Route path="goal/:goalId" element={<GoalDetailPage />} />
          <Route path="daily" element={<DailyViewPage />} />
          <Route path="daily/:date" element={<DailyViewPage />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
          <Route path="inbox" element={<TaskInboxPage />} />
        </Route>
      </Routes>
    </AuthContext.Provider>
  )
}
