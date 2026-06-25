import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'info' | 'warning' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

// Game-UI-Stil: kräftige Farbe, dunklere Unterkante (3D-Tiefe) + heller Glanz oben.
// Beim Drücken sinkt der Button ein (translate + kleinere Unterkante).
const variants = {
  primary:   'bg-violet-500 text-white shadow-[0_5px_0_#5b21b6,inset_0_2px_0_#ffffff59] active:shadow-[0_2px_0_#5b21b6,inset_0_2px_0_#ffffff59]',
  success:   'bg-green-500 text-white shadow-[0_5px_0_#15803d,inset_0_2px_0_#ffffff59] active:shadow-[0_2px_0_#15803d,inset_0_2px_0_#ffffff59]',
  danger:    'bg-red-500 text-white shadow-[0_5px_0_#b91c1c,inset_0_2px_0_#ffffff59] active:shadow-[0_2px_0_#b91c1c,inset_0_2px_0_#ffffff59]',
  info:      'bg-sky-500 text-white shadow-[0_5px_0_#0369a1,inset_0_2px_0_#ffffff59] active:shadow-[0_2px_0_#0369a1,inset_0_2px_0_#ffffff59]',
  warning:   'bg-amber-400 text-amber-900 shadow-[0_5px_0_#b45309,inset_0_2px_0_#ffffff80] active:shadow-[0_2px_0_#b45309,inset_0_2px_0_#ffffff80]',
  secondary: 'bg-slate-400 text-white shadow-[0_5px_0_#475569,inset_0_2px_0_#ffffff4d] active:shadow-[0_2px_0_#475569,inset_0_2px_0_#ffffff4d]',
  ghost:     'bg-transparent text-white/70 active:bg-white/10',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-5 py-3 text-base rounded-2xl',
  lg: 'px-6 py-4 text-lg rounded-2xl',
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`font-bold transition-all duration-100 active:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:shadow-none touch-manipulation select-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" /> : null}
      {children}
    </button>
  )
}
