import { apiFetch } from '@/api/client'

export interface SupportTicket {
  id: number
  subject: string
  message: string
  priority: string
  status: string
  admin_note: string | null
  user_name: string | null
  user_email: string | null
  tenant_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CreateTicketPayload {
  subject: string
  message: string
  priority: string
}

export const createSupportTicket = (payload: CreateTicketPayload) =>
  apiFetch<SupportTicket>('/support/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const fetchMyTickets = () =>
  apiFetch<SupportTicket[]>('/support/tickets')
