import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { useAuthStore } from '@/store/authStore'
import { apiMfaVerify } from '@/api/authApi'
import { LoginLogo } from '@/components/ui/BrandLogo'

const ADMIN_FEATURES = [
  'Global multi-tenant platform administration',
  'Tenant provisioning and subscription lifecycle management',
  'Platform-wide audit logging and security policy enforcement',
  'System health monitoring and infrastructure analytics',
]

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  // MFA step
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaSession, setMfaSession] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string })?.from ?? '/platform-admin'

  function validate() {
    const errors: { email?: string; password?: string } = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid admin email'
    }
    if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    if (!validate()) return

    const result = await login({ email, password })
    if (result === true) {
      const user = useAuthStore.getState().user
      navigate(user?.role === 'PlatformAdmin' ? '/platform-admin' : redirectTo, { replace: true })
    } else if (result && typeof result === 'object' && 'mfaRequired' in result) {
      setMfaSession((result as { mfaSession: string }).mfaSession)
      setMfaStep(true)
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault()
    setMfaLoading(true)
    setMfaError(null)
    const result = await apiMfaVerify(mfaSession, totpCode)
    setMfaLoading(false)
    if (result.success && result.user) {
      useAuthStore.setState({ user: result.user, isAuthenticated: true })
      navigate('/platform-admin', { replace: true })
    } else {
      setMfaError(result.error ?? 'Invalid code. Try again.')
      setTotpCode('')
    }
  }

  if (mfaStep) {
    return (
      <AuthLayout
        headline={
          <>
            Admin 2FA
            <br />
            <span className="text-brand-blue">verification</span>
          </>
        }
        description="Enter the 6-digit code from your authenticator app for Admin access."
        features={ADMIN_FEATURES}
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <ShieldCheck size={28} className="text-brand-blue" />
          </div>
          <h2 className="text-[26px] font-bold text-gray-900 mb-1">Admin Authenticator Code</h2>
        </div>

        <form onSubmit={handleMfaSubmit} noValidate>
          <div className="mb-6">
            <label htmlFor="totp-code" className="block text-[13px] font-medium text-gray-900 mb-1.5">
              Authentication code
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              className="w-full px-3.5 py-3 text-2xl tracking-[0.5em] font-mono text-center rounded-lg border border-gray-200 outline-none focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10"
            />
          </div>

          {mfaError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {mfaError}
            </div>
          )}

          <button
            type="submit"
            disabled={mfaLoading || totpCode.length < 6}
            className="w-full py-2.5 rounded-lg bg-brand-blue text-white text-[15px] font-semibold hover:bg-[#2d5cc8] transition disabled:opacity-60"
          >
            {mfaLoading ? 'Verifying…' : 'Verify & Access Admin Portal'}
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      headline={
        <>
          Platform Admin
          <br />
          <span className="text-brand-blue">Control Center</span>
        </>
      }
      description="Dedicated administrative portal for managing security tenants, global policies, and system infrastructure."
      features={ADMIN_FEATURES}
    >
      <div className="flex items-center gap-2 mb-4">
        <LoginLogo />
        <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full flex items-center gap-1">
          <Lock size={12} /> Admin Portal
        </span>
      </div>

      <h2 className="text-[26px] font-bold text-gray-900 mb-1.5">Platform Admin Sign In</h2>
      <p className="text-sm text-gray-500 mb-8">
        Access global system configuration and platform management.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-[18px]">
          <label htmlFor="admin-email" className="block text-[13px] font-medium text-gray-900 mb-1.5">
            Admin Email Address
          </label>
          <input
            id="admin-email"
            type="email"
            placeholder="admin@netxdr.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10 ${
              fieldErrors.email ? 'border-red-500' : 'border-gray-200'
            }`}
          />
          {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
        </div>

        <div className="mb-[18px]">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="admin-password" className="block text-[13px] font-medium text-gray-900">
              Admin Password
            </label>
          </div>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10 ${
                fieldErrors.password ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>}
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 mt-2 rounded-lg bg-brand-blue text-white text-[15px] font-semibold hover:bg-[#2d5cc8] transition disabled:opacity-60"
        >
          {isLoading ? 'Authenticating…' : 'Sign in to Admin Portal'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6">
        User Sign In?{' '}
        <Link to="/login" className="text-brand-blue font-medium hover:underline">
          Go to User Login
        </Link>
      </p>
    </AuthLayout>
  )
}
