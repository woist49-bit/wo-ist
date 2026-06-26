import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'grey' | 'light' | 'sky' | 'green' | 'amber' | 'violet'
}

// Runder Icon-Button im Game-UI-Stil (3D-Unterkante + Glanz oben).
const variants = {
  grey:   'bg-slate-200 text-slate-700 shadow-[0_3px_0_#94a3b8] active:shadow-[0_1px_0_#94a3b8]',
  light:  'bg-white text-slate-700 shadow-[0_3px_0_#cbd5e1] active:shadow-[0_1px_0_#cbd5e1]',
  sky:    'bg-sky-500 text-white shadow-[0_3px_0_#0369a1,inset_0_2px_0_#ffffff4d] active:shadow-[0_1px_0_#0369a1,inset_0_2px_0_#ffffff4d]',
  green:  'bg-green-500 text-white shadow-[0_3px_0_#15803d,inset_0_2px_0_#ffffff4d] active:shadow-[0_1px_0_#15803d,inset_0_2px_0_#ffffff4d]',
  amber:  'bg-amber-400 text-amber-900 shadow-[0_3px_0_#b45309,inset_0_2px_0_#ffffff66] active:shadow-[0_1px_0_#b45309,inset_0_2px_0_#ffffff66]',
  violet: 'bg-violet-500 text-white shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d] active:shadow-[0_1px_0_#5b21b6,inset_0_2px_0_#ffffff4d]',
}

export function IconButton({ children, className = '', variant = 'grey', ...props }: Props) {
  return (
    <button
      {...props}
      className={`flex items-center justify-center rounded-2xl p-3 transition-all duration-100 active:translate-y-[2px] disabled:opacity-50 touch-manipulation select-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
