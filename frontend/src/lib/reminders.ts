import type { Task } from '../types'

const timers = new Map<string, number>()
let badgeTimer: number | undefined

function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isReminderEnabled(task: Task): boolean {
  return (
    task.status === 'pending' &&
    !!task.scheduled_time &&
    !!task.reminder_time &&
    task.scheduled_date === getToday()
  )
}

function getReminderTime(task: Task): number | null {
  if (!task.reminder_time) return null
  const [y, m, d] = task.scheduled_date.split('-').map(Number)
  const [hh, mm] = task.reminder_time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime()
}

function showTaskNotification(task: Task) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const time = task.scheduled_time || ''
  const notification = new Notification('任务提醒', {
    body: `「${task.title}」安排在 ${time} 开始`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `task-reminder-${task.id}`,
  })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied'
}

export async function enableNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function clearReminderTimers() {
  timers.forEach(timer => window.clearTimeout(timer))
  timers.clear()
}

export function syncTaskReminders(tasks: Task[]) {
  clearReminderTimers()
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.active?.postMessage({ type: 'SYNC_REMINDERS', tasks })
      })
      .catch(() => {})
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = Date.now()
  for (const task of tasks) {
    if (!isReminderEnabled(task)) continue
    const remindAt = getReminderTime(task)
    if (remindAt == null || remindAt <= now) continue
    const timer = window.setTimeout(() => showTaskNotification(task), remindAt - now)
    timers.set(task.id, timer)
  }
}

export function updateTaskBadge(tasks: Task[]) {
  const nav = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (!nav.setAppBadge) return
  const now = Date.now()
  const count = tasks.filter(task => {
    if (!isReminderEnabled(task)) return false
    const remindAt = getReminderTime(task)
    return remindAt != null && remindAt <= now + 60 * 60 * 1000
  }).length
  if (count > 0) {
    nav.setAppBadge(count).catch(() => {})
  } else if (nav.clearAppBadge) {
    nav.clearAppBadge().catch(() => {})
  }
}

export function startBadgeTicker(tasks: Task[]) {
  stopBadgeTicker()
  updateTaskBadge(tasks)
  badgeTimer = window.setInterval(() => updateTaskBadge(tasks), 60_000)
}

export function stopBadgeTicker() {
  if (badgeTimer != null) {
    window.clearInterval(badgeTimer)
    badgeTimer = undefined
  }
}
