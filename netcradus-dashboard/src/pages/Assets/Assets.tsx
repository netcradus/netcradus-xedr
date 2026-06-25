// import Topbar from '@/components/layout/Topbar/Topbar'
// import Card from '@/components/ui/Card/Card'

// export default function Assets() {
//   return (
//     <div className="pb-8">
//       <Topbar title="Assets" subtitle="Inventory of monitored endpoints, servers & cloud assets" />
//   <div className="px-4 sm:px-6 lg:px-8">
//         <Card>
//           <p className="text-gray-500 text-sm">The Assets page content goes here.</p>
//         </Card>
//       </div>
//     </div>
//   )
// }
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'

export default function Assets() {
  return (
    <div className="pb-8">
      <Topbar title="Assets" subtitle="Inventory of monitored endpoints, servers & cloud assets" />
      <div className="px-4 sm:px-6 lg:px-8">
        <Card>
          <p className="text-gray-500 text-sm">The Assets page content goes here.</p>
        </Card>
      </div>
    </div>
  )
}