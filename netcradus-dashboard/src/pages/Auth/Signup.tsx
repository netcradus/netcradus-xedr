import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { useAuthStore } from '@/store/authStore'

const FEATURES = [
  'Free 14-day trial, no credit card required',
  'Setup in under 10 minutes',
  'Dedicated onboarding from day one',
  'SOC 2 Type II certified infrastructure',
]

type FieldErrors = Partial<{
  firstName: string
  lastName: string
  email: string
  company: string
  password: string
}>

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score // 0–4
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-green-500']

export default function Signup() {
  const navigate = useNavigate()
  const { signup, isLoading, error, clearError } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState('Free')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const strength = getPasswordStrength(password)

  function validate() {
    const errors: FieldErrors = {}
    if (!firstName.trim()) errors.firstName = 'Required'
    if (!lastName.trim()) errors.lastName = 'Required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid work email'
    if (!company.trim()) errors.company = 'Required'
    if (password.length < 8) errors.password = 'Password must be at least 8 characters'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    if (!validate()) return

    const ok = await signup({ firstName, lastName, email, company, password, plan })
    if (ok) {
      navigate('/onboarding', { replace: true })
    }
  }

  return (
    <AuthLayout
      headline={
        <>
          Start protecting
          <br />
          your org <span className="text-brand-blue">today</span>
        </>
      }
      description="Join thousands of security teams that trust Netcrad to detect threats before they become incidents."
      features={FEATURES}
    >
      <h2 className="text-[26px] font-bold text-gray-900 mb-1.5">Create your account</h2>
      <p className="text-sm text-gray-500 mb-8">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-blue font-medium hover:underline">
          Sign in
        </Link>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3.5 mb-[18px]">
          <div>
            <label htmlFor="signup-fname" className="block text-[13px] font-medium text-gray-900 mb-1.5">
              First name
            </label>
            <input
              id="signup-fname"
              type="text"
              autoComplete="given-name"
              placeholder="Alex"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10 ${
                fieldErrors.firstName ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            {fieldErrors.firstName && <p className="text-xs text-red-600 mt-1">{fieldErrors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="signup-lname" className="block text-[13px] font-medium text-gray-900 mb-1.5">
              Last name
            </label>
            <input
              id="signup-lname"
              type="text"
              autoComplete="family-name"
              placeholder="Kim"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10 ${
                fieldErrors.lastName ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            {fieldErrors.lastName && <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>}
          </div>
        </div>

        <div className="mb-[18px]">
          <label htmlFor="signup-email" className="block text-[13px] font-medium text-gray-900 mb-1.5">
            Work email
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-company" className="block text-[13px] font-medium text-gray-900 mb-1.5">
            Company
          </label>
          <input
            id="signup-company"
            type="text"
            autoComplete="organization"
            placeholder="Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10 ${
              fieldErrors.company ? 'border-red-500' : 'border-gray-200'
            }`}
          />
          {fieldErrors.company && <p className="text-xs text-red-600 mt-1">{fieldErrors.company}</p>}
        </div>

        <div className="mb-[18px]">
          <label className="block text-[13px] font-medium text-gray-900 mb-1.5">Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Free', 'Pro', 'Enterprise'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  plan === p
                    ? 'bg-brand-blue text-white border-brand-blue'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-blue/40'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {plan === 'Free' && <p className="text-[11px] text-gray-400 mt-1">14-day trial of Pro features included</p>}
        </div>

        <div className="mb-[18px]">
          <label htmlFor="signup-password" className="block text-[13px] font-medium text-gray-900 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
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

          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-[3px] flex-1 rounded-sm transition-colors ${
                      i < strength ? STRENGTH_COLORS[strength] : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{STRENGTH_LABELS[strength]}</p>
            </div>
          )}
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
          {isLoading ? 'Creating account…' : 'Create free account'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
        By creating an account, you agree to our{' '}
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
