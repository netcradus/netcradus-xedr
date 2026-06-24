
import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  dateRangeLabel: string
  toggleSidebar: () => void
  setDateRangeLabel: (label: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  // Starts closed: on mobile/tablet this is an off-canvas drawer, so `true`
  // here would show it (plus its dark overlay) covering the screen on first
  // load. On desktop (lg+) the sidebar ignores this flag entirely — it's
  // forced visible via `lg:translate-x-0` in Sidebar.tsx — so this default
  // only affects mobile/tablet, which is the behavior we want.
  sidebarOpen: false,
  dateRangeLabel: 'May 20 – May 26, 2024',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDateRangeLabel: (label) => set({ dateRangeLabel: label }),
}))