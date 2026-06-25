import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  tone?: 'dark' | 'light'
}

export function Input({ label, error, tone = 'dark', className = '', ...props }: Props) {
  const toneCls = tone === 'light'
    ? 'bg-white text-slate-800 placeholder:text-slate-400 focus:ring-violet-400'
    : 'bg-white/10 text-white placeholder:text-white/40 focus:ring-indigo-500'
  const borderCls = error ? 'border-red-500' : (tone === 'light' ? 'border-[#e6d3a3]' : 'border-white/20')
  const labelCls = tone === 'light' ? 'text-slate-600' : 'text-white/70'

  return (
    <div className="flex flex-col gap-1">
      {label && <label className={`text-sm font-medium ${labelCls}`}>{label}</label>}
      <input
        {...props}
        className={`w-full border-2 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition ${toneCls} ${borderCls} ${className}`}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
