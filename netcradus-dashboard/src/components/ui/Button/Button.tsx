import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export default function Button({
  children,
  variant = 'secondary',
  className = '',
  ...rest
}: PropsWithChildren<ButtonProps>) {
  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors'
  const styles =
    variant === 'primary'
      ? 'bg-navy-900 text-white hover:bg-navy-800'
      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'

  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  )
}
