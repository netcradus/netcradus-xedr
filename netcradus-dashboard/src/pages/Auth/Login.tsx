import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { useAuthStore } from '@/store/authStore'
import netcradIcon from '@/assets/images/netcrad-icon.png'

const FEATURES = [
  'Advanced threat detection with ML-powered analysis',
  'Automated SOAR playbooks for rapid incident response',
  'Compliance reporting across NIST, ISO 27001 & SOC 2',
  'End-to-end endpoint protection and risk scoring',
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const redirectTo = (location.state as { from?: string })?.from ?? '/'

  function validate() {
    const errors: { email?: string; password?: string } = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address'
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

    const ok = await login({ email, password })
    if (ok) {
      navigate(redirectTo, { replace: true })
    }
  }

  return (
    <AuthLayout
      headline={
        <>
          Unified security
          <br />
          intelligence at <span className="text-brand-blue">scale</span>
        </>
      }
      description="Real-time threat detection, automated response, and compliance—all in one platform built for security teams that can't afford to miss a thing."
      features={FEATURES}
    >
      <img src={netcradIcon} alt="Netcrad" className="h-24 w-24 object-contain mx-auto mb-8" />

      <h2 className="text-[26px] font-bold text-gray-900 mb-1.5">Welcome back</h2>
      <p className="text-sm text-gray-500 mb-8">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-brand-blue font-medium hover:underline">
          Create one free
        </Link>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-[18px]">
          <label htmlFor="login-email" className="block text-[13px] font-medium text-gray-900 mb-1.5">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
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
            <label htmlFor="login-password" className="block text-[13px] font-medium text-gray-900">
              Password
            </label>
            <a href="#" className="text-xs text-brand-blue font-medium hover:underline">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
          className="w-full py-2.5 mt-2 rounded-lg bg-brand-blue text-white text-[15px] font-semibold hover:bg-[#2d5cc8] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in…' : 'Sign in to Netcrad'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 whitespace-nowrap">or continue with</span>
        <span className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={() =>
          useAuthStore.setState({
            error: 'SSO is not configured for this demo. Use email and password instead.',
          })
        }
        className="w-full py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2.5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.14c-.22-.66-.35-1.36-.35-2.14s.13-1.48.35-2.14V7.02H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.44 1.18 4.98z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.02l3.66 2.84c.87-2.6 3.3-4.48 6.16-4.48z" />
        </svg>
        Continue with SSO
      </button>

      <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
        By signing in, you agree to our{' '}
        <a href="#" className="text-brand-blue">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="text-brand-blue">
          Privacy Policy
        </a>
      </p>
    </AuthLayout>
  )
}
