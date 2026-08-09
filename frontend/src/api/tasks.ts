import { api } from './client'
import type { DailyTasks, Task, TaskCheckin, WeekProgress } from '../types'

export async function getDailyTasks(date?: string): Promise<DailyTasks> {
  const query = date ? `?target_date=${date}` : ''
  return api.get<DailyTasks>(`/tasks/daily${query}`)
}

export async function checkinTask(data: TaskCheckin): Promise<Task> {
  return api.post<Task>('/tasks/checkin', data)
}

export async function getWeekProgress(weekStart?: string): Promise<WeekProgress> {
  const query = weekStart ? `?week_start=${weekStart}` : ''
  return api.get<WeekProgress>(`/tasks/week${query}`)
}

export async function getOverdueTasks(): Promise<Task[]> {
  return api.get<Task[]>('/tasks/overdue')
}
