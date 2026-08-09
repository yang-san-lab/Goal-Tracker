import { api } from './client'
import type { Goal, GoalListItem, GoalCreate, GoalProgress, AdjustmentResponse, OverloadCheck, ChatMessage } from '../types'

export async function createGoal(data: GoalCreate): Promise<Goal> {
  return api.post<Goal>('/goals/', data)
}

export async function listGoals(): Promise<GoalListItem[]> {
  return api.get<GoalListItem[]>('/goals/')
}

export async function getGoal(goalId: string): Promise<Goal> {
  return api.get<Goal>(`/goals/${goalId}`)
}

export async function deleteGoal(goalId: string): Promise<void> {
  return api.delete(`/goals/${goalId}`)
}

export async function getGoalProgress(goalId: string): Promise<GoalProgress> {
  return api.get<GoalProgress>(`/goals/${goalId}/progress`)
}

export async function getGoalTimeline(goalId: string): Promise<any[]> {
  return api.get<any[]>(`/goals/${goalId}/timeline`)
}

export async function getGoalTasks(goalId: string): Promise<any[]> {
  return api.get<any[]>(`/goals/${goalId}/tasks`)
}

export async function getGoalCalendar(goalId: string): Promise<any> {
  return api.get<any>(`/goals/${goalId}/calendar`)
}

export async function checkOverload(newDailyHours: number = 0): Promise<OverloadCheck> {
  return api.get<OverloadCheck>(`/goals/overload-check?new_daily_hours=${newDailyHours}`)
}

export async function triggerAdjustment(
  goalId: string,
  trigger: string = 'user_request',
): Promise<AdjustmentResponse> {
  return api.post<AdjustmentResponse>('/goals/adjust', { goal_id: goalId, trigger })
}

// ── AI 教练对话 ──

export async function getChatHistory(goalId: string): Promise<ChatMessage[]> {
  return api.get<ChatMessage[]>(`/goals/${goalId}/chat`)
}

export async function sendChatMessage(goalId: string, message: string): Promise<ChatMessage> {
  return api.post<ChatMessage>(`/goals/${goalId}/chat`, { message })
}

export async function applyChatAdjustment(
  goalId: string,
  messageId: string,
): Promise<{ applied: boolean; adjustments_count: number }> {
  return api.post(`/goals/${goalId}/chat/apply`, { message_id: messageId })
}
