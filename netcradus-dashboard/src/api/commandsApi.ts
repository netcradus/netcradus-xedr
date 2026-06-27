import { apiFetch } from '@/api/client'
import type { BackendCommand, CommandType } from '@/types/api.types'

export async function fetchCommands(params?: {
  agent_id?: number
  status?: string
  command_type?: string
}): Promise<BackendCommand[]> {
  const qs = new URLSearchParams()
  if (params?.agent_id) qs.set('agent_id', String(params.agent_id))
  if (params?.status) qs.set('status', params.status)
  if (params?.command_type) qs.set('command_type', params.command_type)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<BackendCommand[]>(`/commands/${query}`)
}

export async function killProcess(agent_id: number, pid: number): Promise<BackendCommand> {
  return apiFetch<BackendCommand>('/commands/kill-process', {
    method: 'POST',
    body: JSON.stringify({ agent_id, pid }),
  })
}

export async function isolateHost(agent_id: number): Promise<BackendCommand> {
  return apiFetch<BackendCommand>('/commands/isolate-host', {
    method: 'POST',
    body: JSON.stringify({ agent_id }),
  })
}

export async function blockIP(agent_id: number, ip_address: string): Promise<BackendCommand> {
  return apiFetch<BackendCommand>('/commands/block-ip', {
    method: 'POST',
    body: JSON.stringify({ agent_id, ip_address }),
  })
}

export async function quarantineFile(agent_id: number, file_path: string): Promise<BackendCommand> {
  return apiFetch<BackendCommand>('/commands/quarantine-file', {
    method: 'POST',
    body: JSON.stringify({ agent_id, file_path }),
  })
}

export async function restoreHost(agent_id: number): Promise<BackendCommand> {
  return apiFetch<BackendCommand>('/commands/restore-host', {
    method: 'POST',
    body: JSON.stringify({ agent_id }),
  })
}

export async function executeCommand(
  type: CommandType,
  agent_id: number,
  arg?: string,
): Promise<BackendCommand> {
  switch (type) {
    case 'kill_process':
      return killProcess(agent_id, Number(arg))
    case 'isolate_host':
      return isolateHost(agent_id)
    case 'block_ip':
      return blockIP(agent_id, arg!)
    case 'quarantine_file':
      return quarantineFile(agent_id, arg!)
    case 'restore_host':
      return restoreHost(agent_id)
  }
}
