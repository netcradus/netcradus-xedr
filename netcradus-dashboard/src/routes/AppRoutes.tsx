import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import Login from '@/pages/Auth/Login'
import Signup from '@/pages/Auth/Signup'
import Dashboard from '@/pages/Dashboard/Dashboard'
import Alerts from '@/pages/Alerts/Alerts'
import Incidents from '@/pages/Incidents/Incidents'
import Assets from '@/pages/Assets/Assets'
import ThreatIntelligence from '@/pages/ThreatIntelligence/ThreatIntelligence'
import Playbooks from '@/pages/Playbooks/Playbooks'
import Reports from '@/pages/Reports/Reports'
import Integrations from '@/pages/Integrations/Integrations'
import Settings from '@/pages/Settings/Settings'
import AuditLogs from '@/pages/AuditLogs/AuditLogs'
import AIQuery from '@/pages/AIQuery/AIQuery'
import SuperAdmin from '@/pages/SuperAdmin/SuperAdmin'
import { useAuthStore } from '@/store/authStore'

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes — redirect away if already signed in */}
      <Route
        path="/login"
        element={
          <AuthRedirect>
            <Login />
          </AuthRedirect>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthRedirect>
            <Signup />
          </AuthRedirect>
        }
      />

      {/* Protected dashboard routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
                <Route path="/playbooks" element={<Playbooks />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/ai-query" element={<AIQuery />} />
                <Route path="/super-admin" element={<SuperAdmin />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
