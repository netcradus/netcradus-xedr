
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import netcradIcon from '@/assets/images/netcrad-icon.png'
import {
  LayoutGrid,
  Bell,
  CircleAlert,
  Monitor,
  Radar,
  Workflow,
  Network,
  FileText,
  Plug,
  Settings,
  ScrollText,
  Headphones,
  LogOut,
  X,
  Sparkles,
  Building2,
  Send,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldAlert,
  Crown,
} from 'lucide-react'
import { NAV_ITEMS, type NavItem } from '@/constants/navItems'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { createSupportTicket } from '@/api/supportApi'

const ICONS: Record<NavItem['icon'], React.ElementType> = {
  dashboard: LayoutGrid,
  bell: Bell,
  incidents: CircleAlert,
  assets: Monitor,
  threatIntel: Radar,
  playbooks: Workflow,
  attackGraph: Network,
  aiQuery: Sparkles,
  reports: FileText,
  integrations: Plug,
  settings: Settings,
  auditLogs: ScrollText,
  superAdmin: Building2,
  detectionRules: ShieldAlert,
}

// ── Support ticket modal ──────────────────────────────────────────────────────

function SupportModal({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [loading, setLoading] = useState(false)
  const [ticketId, setTicketId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setLoading(true)
    setError(null)
    try {
      const ticket = await createSupportTicket({ subject: subject.trim(), message: message.trim(), priority })
      setTicketId(ticket.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Headphones size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Contact Support</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {ticketId ? (
          // ── Success state
          <div className="px-5 py-8 text-center space-y-3">
            <div className="flex justify-center">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Ticket #{ticketId} submitted!</p>
            <p className="text-xs text-gray-500">
              Our team will review your ticket and respond within 24 hours. You can track it via the support portal.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          // ── Form
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Briefly describe your issue…"
                maxLength={200}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail — include any error messages, steps to reproduce, or affected features…"
                rows={5}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !subject.trim() || !message.trim()}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {loading ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [showSupport, setShowSupport] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function closeOnMobile() {
    if (window.innerWidth < 1024) toggleSidebar()
  }

  return (
    <>
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar fixed inset-y-0 left-0 z-40 w-60 h-screen bg-sidebar-primary text-white flex flex-col border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <img src={netcradIcon} alt="Netcrad" className="h-9 w-9 object-contain" />
            <div>
              <p className="font-semibold leading-tight tracking-wide">NETCRAD</p>
              <p className="text-[11px] text-white/50">Hybrid SIEM + SOAR Platform</p>
              <p className="text-[11px] text-white/50">Powered by NETCRADUS</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            aria-label="Close menu"
            className="lg:hidden text-white/60 hover:text-white transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav flex-1 min-h-0 mt-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) => {
            if (item.id === 'super-admin') return user?.role === 'SuperAdmin'
            return true
          }).map((item) => {
            const Icon = ICONS[item.icon]
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                onClick={closeOnMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                    isActive
                      ? 'bg-sidebar-active text-white'
                      : 'text-white/70 hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} />
                  {item.label}
                </span>
                {item.isPremium ? (
                  <span className="flex items-center gap-0.5 text-[10px] bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full px-1.5 py-0.5 font-semibold">
                    <Crown size={8} />PRO
                  </span>
                ) : item.badgeCount ? (
                  <span className="text-[11px] bg-red-500 text-white rounded-full px-2 py-0.5">
                    {item.badgeCount}
                  </span>
                ) : null}
              </NavLink>
            )
          })}

          {/* Help / Support card */}
          <div className="mt-4 p-4 rounded-xl bg-sidebar-secondary border border-sidebar-border">
            <Headphones size={20} className="mb-2 text-white/70" />
            <p className="text-sm font-medium">Need Help?</p>
            <p className="text-[11px] text-white/50 mb-3">Our security experts are available 24/7</p>
            <button
              onClick={() => setShowSupport(true)}
              className="block w-full text-center text-xs bg-white/10 hover:bg-sidebar-hover rounded-lg py-2 transition-colors duration-200"
            >
              Contact Support
            </button>
          </div>
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-sidebar-border flex items-center gap-3 shrink-0">
          <div className="h-8 w-8 rounded-full bg-sidebar-active flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.initials ?? 'U'}
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {user ? `${user.firstName} ${user.lastName}` : 'Account'}
            </p>
            <p className="text-[11px] text-white/50 truncate">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-sidebar-hover transition-colors duration-200"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Support ticket modal */}
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </>
  )
}
