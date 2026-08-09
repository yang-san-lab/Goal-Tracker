import { api } from './client'
import type { PointsBalance, PointTransactionItem, CustomRewardItem } from '../types'

export async function getBalance(): Promise<PointsBalance> {
  return api.get<PointsBalance>('/rewards/balance')
}

export async function getTransactions(): Promise<PointTransactionItem[]> {
  return api.get<PointTransactionItem[]>('/rewards/transactions')
}

export async function listRewards(): Promise<CustomRewardItem[]> {
  return api.get<CustomRewardItem[]>('/rewards/shop')
}

export async function createReward(data: {
  name: string; star_cost: number; description?: string; icon?: string
}): Promise<CustomRewardItem> {
  return api.post<CustomRewardItem>('/rewards/shop', data)
}

export async function updateReward(rewardId: string, data: {
  name?: string; star_cost?: number; description?: string; icon?: string
}): Promise<CustomRewardItem> {
  return api.put<CustomRewardItem>(`/rewards/shop/${rewardId}`, data)
}

export async function deleteReward(rewardId: string): Promise<void> {
  return api.delete(`/rewards/shop/${rewardId}`)
}

export async function redeemReward(rewardId: string): Promise<{ success: boolean; message: string }> {
  return api.post('/rewards/redeem', { reward_id: rewardId })
}
