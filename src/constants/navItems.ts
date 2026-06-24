export interface NavItem {
  id: string
  label: string
  path: string
  icon:
    | 'dashboard'
    | 'bell'
    | 'incidents'
    | 'assets'
    | 'threatIntel'
    | 'penTesting'
    | 'playbooks'
    | 'reports'
    | 'integrations'
    | 'settings'
    | 'auditLogs'
  badgeCount?: number
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: 'dashboard' },
  { id: 'alerts', label: 'Alerts', path: '/alerts', icon: 'bell', badgeCount: 12 },
  { id: 'incidents', label: 'Incidents', path: '/incidents', icon: 'incidents' },
  { id: 'assets', label: 'Assets', path: '/assets', icon: 'assets' },
  { id: 'threat-intelligence', label: 'Threat Intelligence', path: '/threat-intelligence', icon: 'threatIntel' },
  { id: 'pen-testing', label: 'Penetration Testing', path: '/pen-testing', icon: 'penTesting' },
  { id: 'playbooks', label: 'SOAR Playbooks', path: '/playbooks', icon: 'playbooks' },
  { id: 'reports', label: 'Reports & Compliance', path: '/reports', icon: 'reports' },
  { id: 'integrations', label: 'Integrations', path: '/integrations', icon: 'integrations' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings' },
  { id: 'audit-logs', label: 'Audit Logs', path: '/audit-logs', icon: 'auditLogs' },
]
