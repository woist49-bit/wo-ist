interface Props {
  value: number        // aktueller Radius in natürlichen Bildpixeln
  min: number          // min in px
  max: number          // max in px
  percent: number      // Radius als % der kürzeren Bildseite (nur Anzeige)
  onChange: (px: number) => void
}

export function RadiusSlider({ value, min, max, percent, onChange }: Props) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-white/70 block mb-2">Suchradius anpassen</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-green-400"
        />
        <span className="text-xs text-white/50 w-12 text-right font-mono">{percent.toFixed(1)}%</span>
      </div>
    </div>
  )
}
