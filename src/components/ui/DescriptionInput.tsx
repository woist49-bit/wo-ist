interface Props {
  value: string
  onChange: (v: string) => void
  max?: number
  placeholder?: string
}

// Optionales Beschreibungsfeld im hellen Game-UI-Stil mit Zeichenzähler.
export function DescriptionInput({ value, onChange, max = 300, placeholder = 'z. B. ein Hinweis zum Bild' }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-slate-600">Beschreibung (optional)</label>
        <span className={`text-xs ${value.length >= max ? 'text-red-500' : 'text-slate-400'}`}>{value.length}/{max}</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value.slice(0, max))}
        rows={2}
        maxLength={max}
        placeholder={placeholder}
        className="w-full bg-white border-2 border-[#e6d3a3] rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition resize-none"
      />
    </div>
  )
}
