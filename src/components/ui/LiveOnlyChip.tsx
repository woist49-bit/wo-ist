// Kennzeichnet Erfolge, die AUSSCHLIESSLICH über Live-Events erspielbar sind (nicht in
// Kampagnen). Rote Identität wie das Live-Event-Menü. Auf beigem GameCard verwendet.
export function LiveOnlyChip() {
  return (
    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[11px] font-bold rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Nur Live-Event
    </span>
  )
}
