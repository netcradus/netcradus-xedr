import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import Login from '@/pages/Auth/Login'
import Signup from '@/pages/Auth/Signup'
import ForgotPassword from '@/pages/Auth/ForgotPassword'
import ResetPassword from '@/pages/Auth/ResetPassword'
import VerifyEmail from '@/pages/Auth/VerifyEmail'
import Onboarding from '@/pages/Onboarding/Onboarding'
import Dashboard from '@/pages/Dashboard/Dashboard'
import Alerts from '@/pages/Alerts/Alerts'
import Incidents from '@/pages/Incidents/Incidents'
import Assets from '@/pages/Assets/Assets'
import ThreatIntelligence from '@/pages/ThreatIntelligence/ThreatIntelligence'
import Playbooks from '@/pages/Playbooks/Playbooks'
import AttackGraph from '@/pages/AttackGraph/AttackGraph'
import ThreatHunting from '@/pages/ThreatHunting/ThreatHunting'
import SigmaRules from '@/pages/SigmaRules/SigmaRules'
import YaraRules from '@/pages/YaraRules/YaraRules'
import Reports from '@/pages/Reports/Reports'
import Integrations from '@/pages/Integrations/Integrations'
import Settings from '@/pages/Settings/Settings'
import AuditLogs from '@/pages/AuditLogs/AuditLogs'
import AIQuery from '@/pages/AIQuery/AIQuery'
import SuperAdmin from '@/pages/SuperAdmin/SuperAdmin'
import DetectionRules from '@/pages/DetectionRules/DetectionRules'
import Compliance from '@/pages/Compliance/Compliance'
import VulnerabilityScanner from '@/pages/VulnerabilityScanner/VulnerabilityScanner'
import BrowserSecurity from '@/pages/BrowserSecurity/BrowserSecurity'
import PlatformAdmin from '@/pages/PlatformAdmin/PlatformAdmin'
import { useAuthStore } from '@/store/authStore'

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'PlatformAdmin') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes — redirect away if already signed in */}
      <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
      <Route path="/signup" element={<AuthRedirect><Signup /></AuthRedirect>} />
      <Route path="/forgot-password" element={<AuthRedirect><ForgotPassword /></AuthRedirect>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Email verify — works signed-in or not */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Onboarding — protected, no sidebar layout */}
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      {/* Platform Admin — PlatformAdmin role only, own full-page layout */}
      <Route path="/platform-admin" element={<PlatformAdminRoute><PlatformAdmin /></PlatformAdminRoute>} />

      {/* Protected dashboard routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/detection-rules" element={<DetectionRules />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
                <Route path="/playbooks" element={<Playbooks />} />
                <Route path="/attack-graph" element={<AttackGraph />} />
                <Route path="/threat-hunting" element={<ThreatHunting />} />
                <Route path="/sigma-rules" element={<SigmaRules />} />
                <Route path="/yara-rules" element={<YaraRules />} />
                <Route path="/vuln-scanner"      element={<VulnerabilityScanner />} />
                <Route path="/browser-security" element={<BrowserSecurity />} />
                <Route path="/compliance" element={<Compliance />} />
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
