import type { PropsWithChildren } from 'react'
import Sidebar from './Sidebar/Sidebar'

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
