import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, RefreshCw, LogOut, ChevronDown, User } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown/Dropdown'
import Button from '@/components/ui/Button/Button'
import { useAuthStore } from '@/store/authStore'

interface TopbarProps {
  title: string
  subtitle: string
  onRefresh?: () => void
  alertCount?: number
}

export default function Topbar({ title, subtitle, onRefresh, alertCount = 12 }: TopbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center justify-between px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <Dropdown label="May 20 – May 26, 2024" options={['Last 7 Days', 'Last 30 Days', 'This Month']} />
        <Button onClick={onRefresh}>
          <RefreshCw size={16} />
          Refresh
        </Button>
        <button className="relative h-10 w-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
          <Bell size={18} className="text-gray-600" />
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>

        {/* User menu / sign out */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
          >
            <div className="h-6 w-6 rounded-full bg-brand-blue text-white text-[11px] font-semibold flex items-center justify-center">
              {user?.initials ?? <User size={12} />}
            </div>
            <span className="text-sm text-gray-700 max-w-[120px] truncate">
              {user ? user.firstName : 'Account'}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-lg shadow-card z-20 overflow-hidden">
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
