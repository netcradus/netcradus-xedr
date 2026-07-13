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
    | 'playbooks'
    | 'attackGraph'
    | 'threatHunting'
    | 'reports'
    | 'integrations'
    | 'settings'
    | 'auditLogs'
    | 'aiQuery'
    | 'superAdmin'
    | 'detectionRules'
  badgeCount?: number
  isPremium?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: 'dashboard' },
  { id: 'alerts', label: 'Alerts', path: '/alerts', icon: 'bell' },
  { id: 'detection-rules', label: 'Detection Rules', path: '/detection-rules', icon: 'detectionRules' },
  { id: 'incidents', label: 'Incidents', path: '/incidents', icon: 'incidents' },
  { id: 'assets', label: 'Assets', path: '/assets', icon: 'assets' },
  { id: 'threat-intelligence', label: 'Threat Intelligence', path: '/threat-intelligence', icon: 'threatIntel' },
  { id: 'playbooks', label: 'SOAR Playbooks', path: '/playbooks', icon: 'playbooks' },
  { id: 'attack-graph', label: 'Attack Graph', path: '/attack-graph', icon: 'attackGraph', isPremium: true },
  { id: 'threat-hunting', label: 'Threat Hunting', path: '/threat-hunting', icon: 'threatHunting' },
  { id: 'ai-query', label: 'AI Query', path: '/ai-query', icon: 'aiQuery' },
  { id: 'reports', label: 'Reports & Compliance', path: '/reports', icon: 'reports' },
  { id: 'integrations', label: 'Integrations', path: '/integrations', icon: 'integrations' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings' },
  { id: 'audit-logs', label: 'Audit Logs', path: '/audit-logs', icon: 'auditLogs' },
  { id: 'super-admin', label: 'Super Admin', path: '/super-admin', icon: 'superAdmin' },
]
