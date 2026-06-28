import { apiFetch } from '@/api/client'
import type { TenantStats, PlatformStats, TenantUser, TenantAgent } from '@/types/api.types'

export async function fetchPlatformStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>('/super-admin/stats')
}

export async function fetchAllTenants(): Promise<TenantStats[]> {
  return apiFetch<TenantStats[]>('/super-admin/tenants')
}

export async function createTenant(payload: { name: string; plan: string }): Promise<TenantStats> {
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

// ── Per-tenant user management ────────────────────────────────────────────────

export async function fetchTenantUsers(tenant_id: number): Promise<TenantUser[]> {
  return apiFetch<TenantUser[]>(`/super-admin/tenants/${tenant_id}/users`)
}

export async function addTenantUser(
  tenant_id: number,
  payload: { name: string; email: string; password: string; role: string }
): Promise<TenantUser> {
  return apiFetch<TenantUser>(`/super-admin/tenants/${tenant_id}/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeTenantUser(tenant_id: number, user_id: number): Promise<void> {
  await apiFetch(`/super-admin/tenants/${tenant_id}/users/${user_id}`, { method: 'DELETE' })
}

// ── Per-tenant agent management ───────────────────────────────────────────────

export async function fetchTenantAgents(tenant_id: number): Promise<TenantAgent[]> {
  return apiFetch<TenantAgent[]>(`/super-admin/tenants/${tenant_id}/agents`)
}

export async function removeTenantAgent(tenant_id: number, agent_id: number): Promise<void> {
  await apiFetch(`/super-admin/tenants/${tenant_id}/agents/${agent_id}`, { method: 'DELETE' })
}
