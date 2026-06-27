import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, RefreshCw, LogOut, ChevronDown, User, Menu, AlertTriangle, Info, AlertCircle, Zap } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown/Dropdown'
import Button from '@/components/ui/Button/Button'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { fetchAlerts } from '@/api/alertsApi'
import type { BackendAlert } from '@/types/api.types'

interface TopbarProps {
  title: string
  subtitle: string
  onRefresh?: () => void
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  Critical: <Zap size={13} className="text-red-500 shrink-0" />,
  High: <AlertCircle size={13} className="text-orange-500 shrink-0" />,
  Medium: <AlertTriangle size={13} className="text-yellow-500 shrink-0" />,
  Low: <Info size={13} className="text-blue-500 shrink-0" />,
  Informational: <Info size={13} className="text-gray-400 shrink-0" />,
}

const SEVERITY_DOT: Record<string, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-400',
  Low: 'bg-blue-400',
  Informational: 'bg-gray-400',
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Topbar({ title, subtitle, onRefresh }: TopbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [alerts, setAlerts] = useState<BackendAlert[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAlerts()
      .then((all) => setAlerts(all.filter((a) => a.status === 'Open').slice(0, 10)))
      .catch(() => {})
  }, [])

  // close notif panel on outside click
  useEffect(() => {
    if (!notifOpen) return
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const openCount = alerts.length

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          aria-label="Open menu"
          className="lg:hidden shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">{title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <Dropdown label="May 20 – May 26, 2024" options={['Last 7 Days', 'Last 30 Days', 'This Month']} />
        <Button onClick={onRefresh} className="px-3 sm:px-4">
          <RefreshCw size={16} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {/* Bell / Notification panel */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-gray-600" />
            {openCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {openCount > 9 ? '9+' : openCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Open Alerts</span>
                {openCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">
                    {openCount} unresolved
                  </span>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Bell size={28} className="mb-2 opacity-40" />
                    <p className="text-sm">No open alerts</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => { setNotifOpen(false); navigate('/alerts') }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                    >
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOT[alert.severity] ?? 'bg-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 font-medium truncate">{alert.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            {SEVERITY_ICON[alert.severity]}
                            {alert.severity}
                          </span>
                          {alert.mitre_technique && (
                            <span className="text-xs text-gray-400 font-mono">{alert.mitre_technique}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{timeAgo(alert.timestamp)}</span>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              {alerts.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/alerts') }}
                    className="w-full text-xs text-brand-blue font-medium hover:underline text-center"
                  >
                    View all alerts →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 h-10 pl-2 pr-2 sm:pr-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
          >
            <div className="h-6 w-6 rounded-full bg-brand-blue text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
              {user?.initials ?? <User size={12} />}
            </div>
            <span className="hidden sm:inline text-sm text-gray-700 max-w-[120px] truncate">
              {user ? user.firstName : 'Account'}
            </span>
            <ChevronDown size={14} className="hidden sm:inline text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-56 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-card z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user ? `${user.firstName} ${user.lastName}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
