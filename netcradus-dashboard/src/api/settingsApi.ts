import { apiFetch } from '@/api/client'
import type { BackendTeamMember, BackendOrg } from '@/types/api.types'

// ── Org ───────────────────────────────────────────────────────────────────────

export async function fetchOrg(): Promise<BackendOrg> {
  return apiFetch<BackendOrg>('/settings/org')
}

export async function updateOrg(name: string): Promise<BackendOrg> {
  return apiFetch<BackendOrg>('/settings/org', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

// ── Team ──────────────────────────────────────────────────────────────────────

export async function fetchTeam(): Promise<BackendTeamMember[]> {
  return apiFetch<BackendTeamMember[]>('/settings/team')
}

export async function inviteMember(payload: {
  name: string
  email: string
  role: string
  temp_password: string
}): Promise<BackendTeamMember> {
  return apiFetch<BackendTeamMember>('/settings/team/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function changeRole(userId: number, role: string): Promise<BackendTeamMember> {
  return apiFetch<BackendTeamMember>(`/settings/team/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
}

export async function toggleUserStatus(userId: number): Promise<BackendTeamMember> {
  return apiFetch<BackendTeamMember>(`/settings/team/${userId}/status`, {
    method: 'PUT',
  })
}

// ── Account ───────────────────────────────────────────────────────────────────

export async function changePassword(
  current_password: string,
  new_password: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/settings/account/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password }),
  })
}
