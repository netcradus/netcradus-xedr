
import type { PropsWithChildren, ReactNode } from 'react'

interface CardProps {
  className?: string
  /** Optional heading rendered in a flex header row (left side) */
  title?: ReactNode
  /** Optional content rendered on the right of the header, e.g. <CardMenu /> */
  actions?: ReactNode
}

export default function Card({ children, className = '', title, actions }: PropsWithChildren<CardProps>) {
  return (
    // NOTE: no `overflow-hidden` here. Cards must stay overflow-visible so
    // that absolutely positioned children (like dropdown/action menus) are
    // never clipped. Any inner element that genuinely needs clipping (e.g.
    // a chart canvas) should scope `overflow-hidden` to itself, not the card.
    <div className={`bg-white rounded-card shadow-card p-5 overflow-visible ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {title && <h3 className="font-semibold text-gray-900 truncate min-w-0">{title}</h3>}
          {actions && <div className="flex items-center gap-2 shrink-0 ml-auto">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}