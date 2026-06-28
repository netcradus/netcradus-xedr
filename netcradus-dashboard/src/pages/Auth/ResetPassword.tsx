import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { apiResetPassword } from '@/api/authApi'

function getStrength(p: string) {
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}
const COLORS = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-green-500']
const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = getStrength(password)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Invalid reset link. Request a new one.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const result = await apiResetPassword(token, password)
    setLoading(false)
    if (result.success) {
      setDone(true)
      setTimeout(() => navigate('/login', { state: { resetSuccess: true } }), 2500)
    } else {
      setError(result.error ?? 'Reset failed.')
    }
  }

  if (!token) {
    return (
      <AuthLayout headline="Invalid link" description="This reset link is missing or malformed." features={[]}>
        <div className="text-center py-10">
          <XCircle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">This reset link is invalid.</p>
          <Link to="/forgot-password" className="text-brand-blue font-medium hover:underline text-sm">
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      headline={<>Set a new<br /><span className="text-brand-blue">password</span></>}
      description="Choose a strong password for your SentryXDR account."
      features={[
        'At least 8 characters',
        'Mix uppercase and lowercase',
        'Include numbers and symbols',
      ]}
    >
      {done ? (
        <div className="text-center py-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password reset!</h2>
          <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          <h2 className="text-[26px] font-bold text-gray-900 mb-1.5">New password</h2>
          <p className="text-sm text-gray-500 mb-8">Enter and confirm your new password below.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-[18px]">
              <label className="block text-[13px] font-medium text-gray-900 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-gray-200 outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10"
                />
                <button type="button" onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0,1,2,3].map((i) => (
                      <span key={i} className={`h-[3px] flex-1 rounded-sm transition-colors ${i < strength ? COLORS[strength] : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{LABELS[strength]}</p>
                </div>
              )}
            </div>

            <div className="mb-[18px]">
              <label className="block text-[13px] font-medium text-gray-900 mb-1.5">Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10 ${
                  confirm && confirm !== password ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-brand-blue text-white text-[15px] font-semibold hover:bg-[#2d5cc8] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
