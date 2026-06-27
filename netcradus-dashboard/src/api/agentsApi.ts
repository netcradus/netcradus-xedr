import { apiFetch } from '@/api/client'
import type { BackendAgent, OnboardingInfo } from '@/types/api.types'

export async function fetchAgents(): Promise<BackendAgent[]> {
  return apiFetch<BackendAgent[]>('/agents/')
}

export async function fetchOnlineAgents(): Promise<BackendAgent[]> {
  return apiFetch<BackendAgent[]>('/agents/online')
}

export async function fetchOnboardingInfo(): Promise<OnboardingInfo> {
  return apiFetch<OnboardingInfo>('/agents/onboarding')
}
