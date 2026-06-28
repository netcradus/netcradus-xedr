import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { apiForgotPassword } from '@/api/authApi'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const result = await apiForgotPassword(email.trim())
    setLoading(false)
    if (result.success) {
      setSent(true)
    } else {
      setError(result.error ?? 'Something went wrong.')
    }
  }

  return (
    <AuthLayout
      headline={<>Forgot your<br /><span className="text-brand-blue">password?</span></>}
      description="No worries. Enter your email and we'll send you a reset link."
      features={[
        'Link expires in 1 hour for security',
        'Check your spam folder if not received',
        'Contact support if you still need help',
      ]}
    >
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8"
      >
        <ArrowLeft size={14} /> Back to sign in
      </Link>

      {sent ? (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-gray-500 mb-6">
            If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
          </p>
          <Link
            to="/login"
            className="text-sm text-brand-blue font-medium hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-[26px] font-bold text-gray-900 mb-1.5">Reset password</h2>
          <p className="text-sm text-gray-500 mb-8">
            We'll send a reset link to your email address.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5">
              <label htmlFor="forgot-email" className="block text-[13px] font-medium text-gray-900 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-gray-200 outline-none transition-colors focus:border-brand-blue focus:ring-[3px] focus:ring-brand-blue/10"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded-lg bg-brand-blue text-white text-[15px] font-semibold hover:bg-[#2d5cc8] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
