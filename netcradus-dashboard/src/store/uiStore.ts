import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  dateRangeLabel: string
  toggleSidebar: () => void
  setDateRangeLabel: (label: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  dateRangeLabel: 'May 20 – May 26, 2024',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDateRangeLabel: (label) => set({ dateRangeLabel: label }),
}))
