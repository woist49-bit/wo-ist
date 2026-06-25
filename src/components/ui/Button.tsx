import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white',
  secondary: 'bg-white/10 hover:bg-white/20 active:bg-white/5 text-white border border-white/20',
  danger: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white',
  ghost: 'hover:bg-white/10 active:bg-white/5 text-white/80',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-3.5 text-lg font-semibold',
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`rounded-xl font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" /> : null}
      {children}
    </button>
  )
}
