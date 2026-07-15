interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}

// Ein/Aus-Schalter im Game-UI-Stil (heller Karten-Look wie Input tone="light").
// Die echte Checkbox bleibt im DOM (sr-only) – so funktionieren Tastatur und Screenreader,
// während der sichtbare Knopf frei gestaltet ist.
export function Toggle({ checked, onChange, label, hint, disabled }: Props) {
  return (
    <label className={`flex items-center justify-between gap-3 bg-white border-2 border-[#e6d3a3] rounded-xl px-4 py-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block font-bold text-slate-800 text-sm">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 shadow-[inset_0_2px_0_#00000014] ${checked ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-[0_1px_2px_#00000040] transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </label>
  )
}
