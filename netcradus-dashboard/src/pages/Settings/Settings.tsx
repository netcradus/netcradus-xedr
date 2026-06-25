
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'

export default function Settings() {
  return (
    <div className="pb-8">
      <Topbar title="Settings" subtitle="This section is under construction" />
      <div className="px-4 sm:px-6 lg:px-8">
        <Card>
          <p className="text-gray-500 text-sm">The Settings page content goes here.</p>
        </Card>
      </div>
    </div>
  )
}
