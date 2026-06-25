
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface DropdownProps {
  label: string
  options: string[]
  onSelect?: (value: string) => void
}

export default function Dropdown({ label, options, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(label)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape so the menu doesn't stay open and
  // doesn't rely solely on z-index to "feel" dismissed.
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 max-w-[140px] sm:max-w-none"
      >
        <span className="truncate">{selected}</span>
        <ChevronDown size={16} className="shrink-0" />
      </button>
      {open && (
        // z-50 (Tailwind's highest default step) keeps this consistently
        // above card content, charts (SVG can create its own stacking
        // context), and sticky headers, matching CardMenu's layer.
        <div className="absolute right-0 mt-1 w-40 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-card z-50">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setSelected(opt)
                setOpen(false)
                onSelect?.(opt)
              }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}