// ── 用户 ──
export interface User {
  id: string
  username: string
  email: string
  daily_available_hours: number
  timezone: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// ── 目标 ──
export interface Goal {
  id: string
  user_id: string
  title: string
  description: string
  goal_type: 'yearly' | 'monthly' | 'custom'
  start_date: string
  end_date: string
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  ai_breakdown: any
  daily_hours: string
  rest_days_per_week: string
  created_at: string
  updated_at: string
}

export interface GoalListItem {
  id: string
  title: string
  goal_type: string
  start_date: string
  end_date: string
  status: string
  daily_hours: string
  rest_days_per_week: string
  created_at: string
}

export interface GoalCreate {
  title: string
  description: string
  goal_type: string
  start_date: string
  end_date: string
  daily_hours: number
  rest_days_per_week: number
}

export interface OverloadCheck {
  total_daily_hours: number
  goal_count: number
  threshold: number
  is_overloaded: boolean
  warning: string
}

export interface GoalProgress {
  total: number
  completed: number
  delayed: number
  pending: number
  completion_rate: number
}

// ── 任务 ──
export interface Task {
  id: string
  goal_id: string
  user_id: string
  title: string
  description: string
  scheduled_date: string
  duration_minutes: number
  priority: number
  category: string
  status: 'pending' | 'completed' | 'delayed' | 'skipped'
  completed_at: string | null
  delayed_reason: string
  user_note: string
  sort_order: number
  ai_generated: boolean
  goal_title: string
  earnable_stars: number
  // ── 团队分配字段 ──
  assignment_type: string
  assigned_by: string | null
  assigned_by_username: string
  assigned_to: string | null
  assignee_name: string
  team_id: string | null
  assignment_status: string | null
  team_name: string
}

export interface DailyTasks {
  date: string
  tasks: Task[]
  completion_rate: number
  total_minutes: number
  completed_minutes: number
}

export interface WeekProgress {
  week_start: string
  week_end: string
  total_tasks: number
  completed_tasks: number
  delayed_tasks: number
  completion_rate: number
  daily_breakdown: { date: string; total: number; completed: number; rate: number }[]
}

export interface TaskCheckin {
  task_id: string
  action: 'completed' | 'delayed' | 'skipped'
  note: string
  duration_actual?: number
}

// ── 调整 ──
export interface AdjustmentResponse {
  adjustment_id: string
  goal_id: string
  adjustments_made: { task_title: string; original_date: string; new_date: string; reason: string }[]
  message: string
}

// ── AI 教练对话 ──
export interface ChatMessage {
  id: string
  goal_id: string
  role: 'user' | 'ai'
  content: string
  suggested_adjustments: { task_title: string; new_date: string; reason: string }[] | null
  applied: boolean
  created_at: string
}

// ── 积分与奖励 ──
export interface PointsBalance {
  balance: number
  total_earned: number
}

export interface PointTransactionItem {
  id: string
  amount: number
  type: string
  source_task_id: string | null
  created_at: string
}

export interface CustomRewardItem {
  id: string
  name: string
  description: string
  star_cost: number
  icon: string
  is_active: boolean
}

// ── 团队 ──
export interface TeamItem {
  id: string
  name: string
  description: string
  captain_id: string
  invite_code: string
  is_active: string
  member_count: number
  user_role: string
  created_at: string
}

export interface TeamDetail {
  id: string
  name: string
  description: string
  captain_id: string
  invite_code: string
  is_active: string
  member_count: number
  user_role: string
  members: TeamMemberItem[]
  created_at: string
}

export interface TeamMemberItem {
  id: string
  team_id: string
  user_id: string
  username: string
  role: string
  status: string
  created_at: string
}

export interface TeamCreate {
  name: string
  description: string
}

export interface TeamJoin {
  invite_code: string
}
