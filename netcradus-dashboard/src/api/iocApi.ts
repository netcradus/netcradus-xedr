import { apiFetch } from '@/api/client'
import type { BackendIOC, CreateIOCPayload } from '@/types/api.types'

export async function fetchIOCs(params?: {
  ioc_type?: string
  search?: string
  active_only?: boolean
}): Promise<BackendIOC[]> {
  const qs = new URLSearchParams()
  if (params?.ioc_type) qs.set('ioc_type', params.ioc_type)
  if (params?.search) qs.set('search', params.search)
  if (params?.active_only) qs.set('active_only', 'true')
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<BackendIOC[]>(`/iocs${query}`)
}

export async function createIOC(payload: CreateIOCPayload): Promise<BackendIOC> {
  return apiFetch<BackendIOC>('/iocs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteIOC(iocId: number): Promise<void> {
  await apiFetch(`/iocs/${iocId}`, { method: 'DELETE' })
}
