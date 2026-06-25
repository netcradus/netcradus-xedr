
// import { ShieldCheck, CheckCircle2 } from 'lucide-react'
// import Card from '@/components/ui/Card/Card'
// import Button from '@/components/ui/Button/Button'

// export default function StatusBanner() {
//   return (
//     <Card className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
//       <div className="flex items-center gap-3">
//         <span className="h-10 w-10 shrink-0 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
//           <ShieldCheck size={20} />
//         </span>
//         <div>
//           <p className="font-semibold text-gray-900">Your organization is protected</p>
//           <p className="text-sm text-gray-500">No critical incidents at this time. Keep up the good work!</p>
//         </div>
//       </div>

//       <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8 text-sm">
//         <div className="flex items-center gap-2">
//           <CheckCircle2 size={16} className="text-green-500 shrink-0" />
//           <div>
//             <p className="text-gray-400 text-xs">Last Scan</p>
//             <p className="text-gray-900 font-medium">4m ago</p>
//           </div>
//         </div>
//         <div className="flex items-center gap-2">
//           <CheckCircle2 size={16} className="text-green-500 shrink-0" />
//           <div>
//             <p className="text-gray-400 text-xs">Threat Intelligence</p>
//             <p className="text-gray-900 font-medium">Updated</p>
//           </div>
//         </div>
//         <div className="flex items-center gap-2">
//           <CheckCircle2 size={16} className="text-green-500 shrink-0" />
//           <div>
//             <p className="text-gray-400 text-xs">EDR Sensor</p>
//             <p className="text-gray-900 font-medium">All up to date</p>
//           </div>
//         </div>
//       </div>

//       <Button variant="primary" className="w-full lg:w-auto justify-center">
//         View Report
//       </Button>
//     </Card>
//   )
// }
import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import Card from '@/components/ui/Card/Card'
import Button from '@/components/ui/Button/Button'

export default function StatusBanner() {
  return (
    <Card className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
          <ShieldCheck size={20} />
        </span>
        <div>
          <p className="font-semibold text-gray-900">Your organization is protected</p>
          <p className="text-sm text-gray-500">No critical incidents at this time. Keep up the good work!</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <div>
            <p className="text-gray-400 text-xs">Last Scan</p>
            <p className="text-gray-900 font-medium">4m ago</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <div>
            <p className="text-gray-400 text-xs">Threat Intelligence</p>
            <p className="text-gray-900 font-medium">Updated</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <div>
            <p className="text-gray-400 text-xs">EDR Sensor</p>
            <p className="text-gray-900 font-medium">All up to date</p>
          </div>
        </div>
      </div>

      <Button variant="primary">View Report</Button>
    </Card>
  )
}