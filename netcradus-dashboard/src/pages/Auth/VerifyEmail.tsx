import { useEffect, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { apiVerifyEmail } from '@/api/authApi'
import { useAuthStore } from '@/store/authStore'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('No verification token found in the link.')
      return
    }
    apiVerifyEmail(token).then((result) => {
      if (result.success) {
        setStatus('success')
        setTimeout(() => navigate(isAuthenticated ? '/' : '/login'), 3000)
      } else {
        setStatus('error')
        setErrorMsg(result.error ?? 'Verification failed.')
      }
    })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <RefreshCw size={36} className="animate-spin text-brand-blue mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying your email…</h2>
            <p className="text-sm text-gray-500">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email verified!</h2>
            <p className="text-sm text-gray-500">
              Your email has been verified. Redirecting you now…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification failed</h2>
            <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
            <div className="flex flex-col gap-2">
              <Link
                to={isAuthenticated ? '/' : '/login'}
                className="text-sm text-brand-blue font-medium hover:underline"
              >
                {isAuthenticated ? 'Go to dashboard' : 'Back to sign in'}
              </Link>
              <Link to="/forgot-password" className="text-xs text-gray-400 hover:underline">
                Request a new link
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
