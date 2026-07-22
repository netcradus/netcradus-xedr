import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Mail, Terminal, Bell, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { apiResendVerification } from '@/api/authApi'
import { apiFetch } from '@/api/client'

interface OrgInfo {
  id: number
  name: string
  api_key: string | null
  is_active: boolean
}

function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3 font-mono text-sm text-green-400">
      <span className="flex-1 truncate">{value}</span>
      <button
        onClick={copy}
        className="shrink-0 text-gray-400 hover:text-white transition"
        title="Copy"
      >
        {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
      </button>
    </div>
  )
}

const STEPS = [
  { id: 'verify', icon: Mail, label: 'Verify your email' },
  { id: 'agent', icon: Terminal, label: 'Deploy your first agent' },
  { id: 'notify', icon: Bell, label: 'Configure notifications' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(true)
  const [resending, setResending] = useState(false)
  const [resentOk, setResentOk] = useState(false)

  // API key from sessionStorage (set during registration) or fetched from /settings/org
  const sessionKey = sessionStorage.getItem('netcrad_onboarding_key')

  useEffect(() => {
    apiFetch<OrgInfo>('/settings/org')
      .then(setOrg)
      .catch(() => {})
      .finally(() => setLoadingOrg(false))
  }, [])

  const apiKey = org?.api_key ?? sessionKey ?? null

  async function handleResend() {
    if (!user?.email) return
    setResending(true)
    await apiResendVerification(user.email)
    setResending(false)
    setResentOk(true)
  }

  function goToDashboard() {
    sessionStorage.removeItem('netcrad_onboarding_key')
    navigate('/', { replace: true })
  }

  const emailVerified = user?.emailVerified ?? false

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-4">
            <ShieldCheck size={28} className="text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to NET XDR!
          </h1>
          <p className="text-slate-400">
            Let's get your organization set up in a few quick steps.
          </p>
        </div>

        {/* Email verification banner */}
        {!emailVerified && (
          <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <Mail size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-300">
                Verify your email <strong>{user?.email}</strong> to unlock all features.
              </p>
              {resentOk ? (
                <p className="text-xs text-green-400 mt-1">Verification email sent!</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs text-amber-400 underline mt-1 hover:text-amber-300 disabled:opacity-60"
                >
                  {resending ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Step 1 — API Key */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold">1</span>
              <h3 className="font-semibold text-white">Your Tenant API Key</h3>
            </div>
            <p className="text-sm text-slate-400 mb-3">
              Use this key when deploying NET XDR agents. Keep it secret.
            </p>
            {loadingOrg ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <RefreshCw size={14} className="animate-spin" /> Loading API key…
              </div>
            ) : apiKey ? (
              <CopyBox value={apiKey} />
            ) : (
              <p className="text-sm text-slate-500 italic">
                API key not available. Check Settings → Organization.
              </p>
            )}
          </div>

          {/* Step 2 — Deploy agent */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold">2</span>
              <h3 className="font-semibold text-white">Deploy Your First Agent</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Run the agent on any Windows or Linux endpoint you want to monitor.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Windows (PowerShell)</p>
                <CopyBox value={`$env:NETCRADXDR_TENANT_API_KEY="${apiKey ?? '<YOUR_API_KEY>'}"; python main.py`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Linux / macOS (bash)</p>
                <CopyBox value={`NETCRADXDR_TENANT_API_KEY="${apiKey ?? '<YOUR_API_KEY>'}" python3 main.py`} />
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              The agent is in <code className="text-slate-400">agent/</code> directory of the NET XDR repository.
              Once running, it will appear in your Assets page within 60 seconds.
            </p>
          </div>

          {/* Step 3 — Notifications */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold">3</span>
              <h3 className="font-semibold text-white">Configure Notifications (optional)</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Get alerted on Slack, Microsoft Teams, or email when critical threats are detected.
            </p>
            <button
              onClick={() => { sessionStorage.removeItem('netcrad_onboarding_key'); navigate('/settings') }}
              className="text-sm text-blue-400 hover:text-blue-300 underline transition"
            >
              Open Notification Settings →
            </button>
          </div>
        </div>

        {/* Checklist */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Quick checklist</p>
          <div className="space-y-2">
            {STEPS.map(({ id, icon: Icon, label }) => {
              const done = id === 'verify' ? emailVerified : false
              return (
                <div key={id} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? 'bg-green-500 border-green-500' : 'border-slate-600'}`}>
                    {done && <Check size={9} className="text-white" />}
                  </div>
                  <Icon size={13} className={done ? 'text-green-400' : 'text-slate-500'} />
                  <span className={`text-sm ${done ? 'text-green-400 line-through' : 'text-slate-300'}`}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={goToDashboard}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition active:scale-[0.99]"
        >
          Go to Dashboard <ArrowRight size={16} />
        </button>

        <p className="text-center text-xs text-slate-600 mt-4">
          You can always revisit setup from Settings at any time.
        </p>
      </div>
    </div>
  )
}
