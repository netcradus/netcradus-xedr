import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Dashboard from '@/pages/Dashboard/Dashboard'
import Alerts from '@/pages/Alerts/Alerts'
import Incidents from '@/pages/Incidents/Incidents'
import Assets from '@/pages/Assets/Assets'
import ThreatIntelligence from '@/pages/ThreatIntelligence/ThreatIntelligence'
import PenTesting from '@/pages/PenTesting/PenTesting'
import Playbooks from '@/pages/Playbooks/Playbooks'
import Reports from '@/pages/Reports/Reports'
import Integrations from '@/pages/Integrations/Integrations'
import Settings from '@/pages/Settings/Settings'
import AuditLogs from '@/pages/AuditLogs/AuditLogs'

export default function AppRoutes() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
        <Route path="/pen-testing" element={<PenTesting />} />
        <Route path="/playbooks" element={<Playbooks />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
      </Routes>
    </DashboardLayout>
  )
}
