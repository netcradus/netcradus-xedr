
import type { PropsWithChildren } from 'react'
import Sidebar from './Sidebar/Sidebar'
import Footer from './Footer/Footer'

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-[#F3F5F9] overflow-x-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  )
}