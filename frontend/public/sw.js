const CACHE_NAME = 'goal-tracker-v3'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

function isTodayLocal(dateStr) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dateStr === today
}

function toLocalTimestamp(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime()
}

const reminderTimers = new Map()

self.addEventListener('message', event => {
  const data = event.data
  if (!data || data.type !== 'SYNC_REMINDERS') return

  for (const timer of reminderTimers.values()) {
    self.clearTimeout(timer)
  }
  reminderTimers.clear()

  const now = Date.now()
  for (const task of data.tasks || []) {
    if (task.status !== 'pending' || !task.scheduled_time || !task.reminder_time) continue
    if (!isTodayLocal(task.scheduled_date)) continue

    const remindAt = toLocalTimestamp(task.scheduled_date, task.reminder_time)
    if (remindAt <= now) continue

    const timer = self.setTimeout(() => {
      self.registration.showNotification('任务提醒', {
        body: `「${task.title}」安排在 ${task.scheduled_time} 开始`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `task-reminder-${task.id}`,
      })
      reminderTimers.delete(task.id)
    }, remindAt - now)
    reminderTimers.set(task.id, timer)
  }
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
