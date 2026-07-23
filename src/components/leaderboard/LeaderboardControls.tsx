import { Crown, Trophy } from 'lucide-react'

export type LeaderSort = 'points' | 'level' | 'name'
const LABELS: Record<LeaderSort, string> = { points: 'Punkte', level: 'Level', name: 'Name' }
const ORDER: LeaderSort[] = ['points', 'level', 'name']

// Sortiert eine beliebige Ranglisten-Zeile (Welt/Global/Event teilen total_points, xp, username).
// WICHTIG: nur die Anzeige-Reihenfolge – der Platz (Medaille) bleibt separat der Punkte-Platz.
export function sortLeaders<T extends { total_points: number; xp: number; username: string }>(rows: T[], sort: LeaderSort): T[] {
  const copy = [...rows]
  if (sort === 'name') copy.sort((a, b) => a.username.localeCompare(b.username, 'de', { sensitivity: 'base' }))
  else if (sort === 'level') copy.sort((a, b) => b.xp - a.xp || b.total_points - a.total_points)
  else copy.sort((a, b) => b.total_points - a.total_points || b.xp - a.xp)
  return copy
}

const VARIANTS = {
  global: { title: 'Globale Rangliste', bg: 'bg-amber-500', shadow: 'shadow-[0_4px_0_#b45309]', activeText: 'text-amber-700' },
  world: { title: 'Spielwelt-Rangliste', bg: 'bg-sky-500', shadow: 'shadow-[0_4px_0_#0369a1]', activeText: 'text-sky-700' },
  event: { title: 'Event-Rangliste', bg: 'bg-rose-500', shadow: 'shadow-[0_4px_0_#9f1239]', activeText: 'text-rose-700' },
} as const
export type LeaderVariant = keyof typeof VARIANTS

// Farbiges Kopf-Banner je Ranglisten-Typ (eigene Farbe + Icon) mit integrierter Sortier-Leiste.
export function LeaderboardHeader({ variant, title, subtitle, sort, onSort }: {
  variant: LeaderVariant
  title?: string        // überschreibt den Standard-Titel (z. B. Weltname bei der Spielwelt)
  subtitle?: string
  sort: LeaderSort
  onSort: (s: LeaderSort) => void
}) {
  const v = VARIANTS[variant]
  const display = title ?? v.title
  return (
    <div className={`rounded-2xl px-4 py-3 mb-4 text-white ${v.bg} ${v.shadow}`}>
      <div className="flex items-center gap-2.5">
        {variant === 'global' ? <Crown size={28} strokeWidth={2.5} className="flex-shrink-0" />
          : variant === 'world' ? <Trophy size={28} strokeWidth={2.5} className="flex-shrink-0" />
          : <span className="w-3.5 h-3.5 rounded-full bg-white animate-pulse flex-shrink-0" />}
        <div className="min-w-0">
          <p className="text-xl font-extrabold leading-tight truncate">{display}</p>
          {subtitle && <p className="text-xs text-white/85 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        {ORDER.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onSort(s)}
            aria-pressed={sort === s}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${sort === s ? `bg-white ${v.activeText}` : 'bg-white/20 text-white active:bg-white/30'}`}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

// Standalone-Sortier-Chips (ohne Banner) – für die Event-Rangliste, die ihre Identität
// schon vom roten Live-Event-Kopf hat.
export function SortChips({ sort, onSort, accent = 'bg-violet-500' }: {
  sort: LeaderSort
  onSort: (s: LeaderSort) => void
  accent?: string
}) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="text-xs font-bold text-white/50 mr-0.5">Sortieren</span>
      {ORDER.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onSort(s)}
          aria-pressed={sort === s}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${sort === s ? `${accent} text-white` : 'bg-white/10 text-white/70 active:bg-white/20'}`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  )
}
