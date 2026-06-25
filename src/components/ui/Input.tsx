import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-white/70">{label}</label>}
      <input
        {...props}
        className={`w-full bg-white/10 border ${error ? 'border-red-500' : 'border-white/20'} rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${className}`}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
