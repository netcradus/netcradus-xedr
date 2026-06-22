import { NavLink } from 'react-router-dom'
import netcradusLogo from '@/assets/images/netcradus-logo.png'
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
} from 'lucide-react'
import { NAV_ITEMS, type NavItem } from '@/constants/navItems'

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
  return (
    <aside className="w-60 shrink-0 h-screen bg-navy-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img src={netcradusLogo} alt="Netcradus" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-semibold leading-tight tracking-wide">NETCRADUS</p>
            <p className="text-[11px] text-white/50">Hybrid SIEM + SOAR Platform</p>
          </div>
        </div>
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
        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm">A</div>
        <div className="leading-tight">
          <p className="text-sm font-medium">Admin User</p>
          <p className="text-[11px] text-white/50">admin@acme.com</p>
        </div>
      </div>
    </aside>
  )
}
