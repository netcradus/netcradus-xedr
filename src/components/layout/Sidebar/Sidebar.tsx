
import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import {
  LayoutGrid,
  Bell,
  CircleAlert,
  Monitor,
  Radar,
  Crosshair,
  Workflow,
  FileText,
  Plug,
  Settings,
  ScrollText,
  Headphones,
  LogOut,
  X,
} from 'lucide-react'
import { NAV_ITEMS, type NavItem } from '@/constants/navItems'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

const ICONS: Record<NavItem['icon'], React.ElementType> = {
  dashboard: LayoutGrid,
  bell: Bell,
  incidents: CircleAlert,
  assets: Monitor,
  threatIntel: Radar,
  penTesting: Crosshair,
  playbooks: Workflow,
  reports: FileText,
  integrations: Plug,
  settings: Settings,
  auditLogs: ScrollText,
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // On mobile/tablet (below lg) the sidebar is an off-canvas drawer, so any
  // nav click should close it; on lg+ it's permanently docked and this is a
  // no-op since the drawer-only overlay/transform classes don't apply there.
  function handleNavClick() {
    if (window.innerWidth < 1024) toggleSidebar()
  }

  // If the drawer is left open and the viewport grows past the lg
  // breakpoint (desktop), reset the flag to false. Desktop ignores
  // sidebarOpen visually, but without this a later resize back down to
  // mobile/tablet would reopen the drawer unexpectedly.
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024 && sidebarOpen) {
        useUIStore.setState({ sidebarOpen: false })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [sidebarOpen])

  return (
    <>
      {/* Dark overlay behind the drawer — mobile/tablet only, shown when open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-64 shrink-0 h-screen bg-navy-900 text-white flex flex-col
          transition-transform duration-300 ease-in-out
          lg:static lg:z-0 lg:w-60 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-brand-blue flex items-center justify-center text-sm font-semibold shrink-0">
              N
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight tracking-wide truncate">NETCRAD</p>
              <p className="text-[11px] text-white/50 truncate">Hybrid SIEM + SOAR
              <p className="text-[11px] text-white/50 truncate">Platform powered by Netcradus</p>
              </p>
            </div>
          </div>
          {/* Close button — mobile/tablet drawer only */}
          <button
            onClick={toggleSidebar}
            aria-label="Close menu"
            className="lg:hidden shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon]
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-brand-blue text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} />
                  {item.label}
                </span>
                {item.badgeCount ? (
                  <span className="text-[11px] bg-red-500 text-white rounded-full px-2 py-0.5">
                    {item.badgeCount}
                  </span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>

        {/* Help card */}
        <div className="mx-4 mb-4 p-4 rounded-xl bg-white/5">
          <Headphones size={20} className="mb-2 text-white/70" />
          <p className="text-sm font-medium">Need Help?</p>
          <p className="text-[11px] text-white/50 mb-3">Our security experts are available 24/7</p>
          <button className="w-full text-xs bg-white/10 hover:bg-white/15 rounded-lg py-2">
            Contact Support
          </button>
        </div>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center text-sm font-semibold shrink-0">
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
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  )
}