export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  company: string
  initials: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  firstName: string
  lastName: string
  email: string
  company: string
  password: string
}

export interface AuthResult {
  success: boolean
  error?: string
}
