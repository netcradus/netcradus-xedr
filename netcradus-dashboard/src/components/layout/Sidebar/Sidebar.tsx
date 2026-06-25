
import { NavLink, useNavigate } from 'react-router-dom'
import netcradIcon from '@/assets/images/netcrad-icon.png'
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
  const { sidebarOpen, toggleSidebar } = useUIStore()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function closeOnMobile() {
    if (window.innerWidth < 1024) toggleSidebar()
  }

  return (
    <>
      {/* Backdrop — only rendered on mobile/tablet while the drawer is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar fixed lg:static inset-y-0 left-0 z-40 w-60 shrink-0 h-screen bg-sidebar-primary text-white flex flex-col border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
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
        <nav className="sidebar-nav flex-1 mt-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
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
        <div className="mx-4 mb-4 p-4 rounded-xl bg-sidebar-secondary border border-sidebar-border">
          <Headphones size={20} className="mb-2 text-white/70" />
          <p className="text-sm font-medium">Need Help?</p>
          <p className="text-[11px] text-white/50 mb-3">Our security experts are available 24/7</p>
          <button className="w-full text-xs bg-white/10 hover:bg-sidebar-hover rounded-lg py-2 transition-colors duration-200">
            Contact Support
          </button>
        </div>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-sidebar-border flex items-center gap-3">
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
    </>
  )
}