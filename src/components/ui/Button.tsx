import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

// Game-UI-Stil: kräftige Farbe + dunklere Unterkante (3D-Tiefe), beim Drücken "einsinken".
const variants = {
  primary:   'bg-indigo-500 text-white shadow-[0_4px_0_#3730a3] active:shadow-[0_2px_0_#3730a3]',
  success:   'bg-green-500 text-white shadow-[0_4px_0_#15803d] active:shadow-[0_2px_0_#15803d]',
  danger:    'bg-red-500 text-white shadow-[0_4px_0_#b91c1c] active:shadow-[0_2px_0_#b91c1c]',
  secondary: 'bg-slate-500 text-white shadow-[0_4px_0_#334155] active:shadow-[0_2px_0_#334155]',
  ghost:     'bg-transparent text-white/80 active:bg-white/10',
}

const sizes = {
  sm: 'px-3.5 py-2 text-sm rounded-xl',
  md: 'px-5 py-3 text-base rounded-2xl',
  lg: 'px-6 py-4 text-lg rounded-2xl',
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`font-bold transition-all duration-100 active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:shadow-none touch-manipulation select-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" /> : null}
      {children}
    </button>
  )
}
