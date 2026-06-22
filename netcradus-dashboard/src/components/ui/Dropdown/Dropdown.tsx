import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface DropdownProps {
  label: string
  options: string[]
  onSelect?: (value: string) => void
}

export default function Dropdown({ label, options, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(label)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
      >
        {selected}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-card z-10">
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
