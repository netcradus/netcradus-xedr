import type { PropsWithChildren } from 'react'

interface CardProps {
  className?: string
}

export default function Card({ children, className = '' }: PropsWithChildren<CardProps>) {
  return (
    <div className={`bg-white rounded-card shadow-card p-5 ${className}`}>
      {children}
    </div>
  )
}
