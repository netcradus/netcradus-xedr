import { apiFetch } from '@/api/client'
import type { NotificationConfig, TestNotificationResult } from '@/types/api.types'

export async function fetchNotificationConfig(): Promise<NotificationConfig> {
  return apiFetch<NotificationConfig>('/notifications/config')
}

export async function updateNotificationConfig(
  payload: Partial<NotificationConfig>,
): Promise<NotificationConfig> {
  return apiFetch<NotificationConfig>('/notifications/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function testNotifications(): Promise<TestNotificationResult> {
  return apiFetch<TestNotificationResult>('/notifications/test', { method: 'POST' })
}
