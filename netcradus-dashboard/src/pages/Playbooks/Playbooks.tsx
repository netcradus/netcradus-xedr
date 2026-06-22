import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'

export default function Playbooks() {
  return (
    <div className="pb-8">
      <Topbar title="SOAR Playbooks" subtitle="Automated response playbooks & orchestration rules" />
      <div className="px-8">
        <Card>
          <p className="text-gray-500 text-sm">The Playbooks page content goes here.</p>
        </Card>
      </div>
    </div>
  )
}
