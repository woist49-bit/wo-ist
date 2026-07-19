import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  tone?: 'dark' | 'light'
}

export function Input({ label, error, tone = 'dark', className = '', type, ...props }: Props) {
  const toneCls = tone === 'light'
    ? 'bg-white text-slate-800 placeholder:text-slate-400 focus:ring-violet-400'
    : 'bg-white/10 text-white placeholder:text-white/40 focus:ring-indigo-500'
  const borderCls = error ? 'border-red-500' : (tone === 'light' ? 'border-[#e6d3a3]' : 'border-white/20')
  const labelCls = tone === 'light' ? 'text-slate-600' : 'text-white/70'

  // Passwortfelder bekommen ein Auge zum Ein-/Ausblenden. Wenn sichtbar, wird der type
  // auf "text" umgeschaltet – dann zeigt der Browser das Passwort im Klartext.
  const isPassword = type === 'password'
  const [show, setShow] = useState(false)
  const effectiveType = isPassword && show ? 'text' : type
  const eyeCls = tone === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-white/50 hover:text-white/80'

  return (
    <div className="flex flex-col gap-1">
      {label && <label className={`text-sm font-medium ${labelCls}`}>{label}</label>}
      <div className="relative">
        <input
          {...props}
          type={effectiveType}
          className={`w-full border-2 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition ${toneCls} ${borderCls} ${isPassword ? 'pr-12' : ''} ${className}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            // tabIndex -1: das Auge soll den Tab-Fokus zwischen den Feldern nicht unterbrechen
            tabIndex={-1}
            aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 active:scale-90 transition-transform ${eyeCls}`}
          >
            {show ? <EyeOff size={20} strokeWidth={2.25} /> : <Eye size={20} strokeWidth={2.25} />}
          </button>
        )}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
