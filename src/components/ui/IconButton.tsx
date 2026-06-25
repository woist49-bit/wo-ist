import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'grey' | 'light'
}

// Runder Icon-Button im Game-UI-Stil (heller Body, dunklere Unterkante als 3D-Tiefe).
const variants = {
  grey:  'bg-slate-200 text-slate-700 shadow-[0_3px_0_#94a3b8] active:shadow-[0_1px_0_#94a3b8]',
  light: 'bg-white text-slate-700 shadow-[0_3px_0_#cbd5e1] active:shadow-[0_1px_0_#cbd5e1]',
}

export function IconButton({ children, className = '', variant = 'grey', ...props }: Props) {
  return (
    <button
      {...props}
      className={`flex items-center justify-center rounded-2xl p-2.5 transition-all duration-100 active:translate-y-[2px] disabled:opacity-50 touch-manipulation select-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
