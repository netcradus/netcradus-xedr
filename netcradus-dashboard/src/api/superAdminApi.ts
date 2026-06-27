import { apiFetch } from '@/api/client'
import type { TenantStats, PlatformStats } from '@/types/api.types'

export async function fetchPlatformStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>('/super-admin/stats')
}

export async function fetchAllTenants(): Promise<TenantStats[]> {
  return apiFetch<TenantStats[]>('/super-admin/tenants')
}

export async function createTenant(payload: {
  name: string
  plan: string
}): Promise<TenantStats> {
  return apiFetch<TenantStats>('/super-admin/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function toggleTenantStatus(
  tenant_id: number,
  is_active: boolean
): Promise<{ id: number; is_active: boolean }> {
  return apiFetch(`/super-admin/tenants/${tenant_id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ is_active }),
  })
}

export async function updateTenantPlan(
  tenant_id: number,
  plan: string
): Promise<{ id: number; plan: string }> {
  return apiFetch(`/super-admin/tenants/${tenant_id}/plan`, {
    method: 'PUT',
    body: JSON.stringify({ plan }),
  })
}
