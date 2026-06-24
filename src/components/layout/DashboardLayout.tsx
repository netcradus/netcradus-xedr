
import type { PropsWithChildren } from 'react'
import Sidebar from './Sidebar/Sidebar'

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    // No `flex` row here below lg: Sidebar is `fixed` (off-canvas) on
    // mobile/tablet so it must not consume layout space or push content
    // over. At lg+, Sidebar switches to `static` and `lg:flex` below
    // restores the side-by-side row so it sits inline as before.
    <div className="lg:flex min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      {/*
        overflow-y-auto is required here for page scrolling, but it used to be
        the reason card/table action menus rendered as normal absolute-positioned
        children got clipped the moment a card sat near the edge of this scroll
        area. CardMenu now renders through a portal into document.body, so it is
        no longer a descendant of this element and is unaffected by this overflow.
        overflow-x-hidden is added explicitly so horizontal scroll never appears
        and clips anything unexpectedly.
      */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  )
}