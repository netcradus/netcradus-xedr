import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Eye, RefreshCw, Download, Trash2 } from 'lucide-react'

export interface CardMenuAction {
  /** Unique key for the action, returned via onAction */
  key: string
  label: string
  icon?: React.ElementType
  /** Renders the item in red and adds a separator above it */
  destructive?: boolean
}

interface CardMenuProps {
  /** Accessible label for the trigger button, e.g. "Alerts Over Time card actions" */
  ariaLabel?: string
  /** Custom action list. Defaults to View Details / Refresh / Export / Delete */
  actions?: CardMenuAction[]
  onAction?: (key: string) => void
  className?: string
}

const DEFAULT_ACTIONS: CardMenuAction[] = [
  { key: 'view', label: 'View Details', icon: Eye },
  { key: 'refresh', label: 'Refresh', icon: RefreshCw },
  { key: 'export', label: 'Export', icon: Download },
  { key: 'delete', label: 'Delete', icon: Trash2, destructive: true },
]

/**
 * Three-dot (ellipsis) action menu for dashboard cards, table rows, and widgets.
 *
 * Root-cause fix: the menu panel is rendered through a React portal directly
 * into document.body and positioned with `fixed` + coordinates measured from
 * the trigger button. This means it is NEVER a descendant of any card, table,
 * or layout wrapper that uses `overflow-hidden` / `overflow-y-auto`, so it can
 * no longer be clipped no matter where the trigger lives in the DOM tree.
 * It also renders above everything via a single, consistent z-[1000] layer
 * instead of ad-hoc z-10 / z-20 values scattered across the app.
 */
export default function CardMenu({
  ariaLabel = 'Open menu',
  actions = DEFAULT_ACTIONS,
  onAction,
  className = '',
}: CardMenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const MENU_WIDTH = 192 // 12rem (w-48)
  const MENU_MARGIN = 8

  function computePosition() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()

    // Default: open below, right-aligned to the trigger.
    let top = rect.bottom + 4
    let left = rect.right - MENU_WIDTH

    // Flip above the trigger if there isn't enough room below the viewport.
    const estimatedMenuHeight = actions.length * 40 + 16
    if (top + estimatedMenuHeight > window.innerHeight - MENU_MARGIN) {
      top = rect.top - estimatedMenuHeight - 4
    }

    // Clamp horizontally so the menu never runs off the left/right edge.
    if (left < MENU_MARGIN) left = MENU_MARGIN
    if (left + MENU_WIDTH > window.innerWidth - MENU_MARGIN) {
      left = window.innerWidth - MENU_WIDTH - MENU_MARGIN
    }

    setCoords({ top, left })
  }

  // Recompute position the instant we open, before paint, to avoid a flash
  // at the wrong coordinates.
  useLayoutEffect(() => {
    if (open) computePosition()
  }, [open])

  // Keep the menu glued to the trigger on scroll/resize anywhere in the app
  // (since the menu is portaled out of any local scroll container).
  useEffect(() => {
    if (!open) return

    function handleReposition() {
      computePosition()
    }
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSelect(key: string) {
    setOpen(false)
    onAction?.(key)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        // h-8 w-8 keeps the visible icon button compact and aligned with the
        // app's other icon buttons; the padding+negative-margin trick below
        // grows the actual tap target to ~44px (mobile touch-target minimum)
        // without shifting surrounding layout (table cells, flex gaps, etc).
        className={`relative shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors before:absolute before:-inset-1.5 before:content-[''] ${className}`}
      >
        <MoreVertical size={18} />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="z-[1000] bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-fade-in-glow"
          >
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(action.key)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors ${
                    action.destructive
                      ? 'text-red-600 hover:bg-red-50 border-t border-gray-100 mt-1'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {Icon && <Icon size={15} />}
                  {action.label}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}