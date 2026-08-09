import { api } from './client'
import type { TeamItem, TeamDetail, Task } from '../types'

export async function listTeams(): Promise<TeamItem[]> {
  return api.get<TeamItem[]>('/teams/')
}

export async function createTeam(data: { name: string; description: string }): Promise<TeamDetail> {
  return api.post<TeamDetail>('/teams/', data)
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  return api.get<TeamDetail>(`/teams/${teamId}`)
}

export async function joinTeam(inviteCode: string): Promise<TeamDetail> {
  return api.post<TeamDetail>('/teams/join', { invite_code: inviteCode })
}

export async function removeMember(teamId: string, memberUserId: string): Promise<void> {
  return api.delete(`/teams/${teamId}/members/${memberUserId}`)
}

export async function leaveTeam(teamId: string): Promise<void> {
  return api.post(`/teams/${teamId}/leave`)
}

export async function assignTask(teamId: string, taskId: string, assigneeId: string): Promise<Task> {
  return api.post<Task>(`/teams/${teamId}/tasks/${taskId}/assign`, { assignee_id: assigneeId })
}

export async function getTeamTasks(teamId: string): Promise<Task[]> {
  return api.get<Task[]>(`/teams/${teamId}/tasks`)
}

export async function getTaskInbox(): Promise<Task[]> {
  return api.get<Task[]>('/tasks/inbox')
}

export async function acceptTask(taskId: string): Promise<Task> {
  return api.post<Task>(`/tasks/${taskId}/accept`)
}

export async function rejectTask(taskId: string): Promise<Task> {
  return api.post<Task>(`/tasks/${taskId}/reject`)
}
