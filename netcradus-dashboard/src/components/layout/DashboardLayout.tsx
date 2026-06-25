
// import type { PropsWithChildren } from 'react'
// import Sidebar from './Sidebar/Sidebar'
// import Footer from './Footer/Footer'

// export default function DashboardLayout({ children }: PropsWithChildren) {
//   return (
//     <div className="flex min-h-screen bg-[#F3F5F9]">
//       <Sidebar />
//       <main className="flex-1 overflow-y-auto flex flex-col">
//         <div className="flex-1">{children}</div>
//         <Footer />
//       </main>
//     </div>
//   )
// }
import type { PropsWithChildren } from 'react'
import Sidebar from './Sidebar/Sidebar'

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-[#F3F5F9] overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  )
}
