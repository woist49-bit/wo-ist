import { Medal, Lock } from 'lucide-react'

// Medaillen-Optik: weißer runder Hintergrund mit tier-farbigem Rand + Medaillen-Icon
// in der jeweiligen Tier-Farbe (Gold/Silber/Bronze). Gesperrt = grau mit Schloss.
const TIER = {
  gold: { ring: '#eab308', icon: 'text-yellow-500' },
  silver: { ring: '#94a3b8', icon: 'text-slate-400' },
  bronze: { ring: '#b45309', icon: 'text-amber-700' },
}

export function MedalBadge({
  tier,
  locked = false,
  size = 40,
}: {
  tier: 'gold' | 'silver' | 'bronze'
  locked?: boolean
  size?: number
}) {
  const t = TIER[tier]
  const iconSize = Math.round(size * 0.58)
  return (
    <div
      className="rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
      style={{ width: size, height: size, border: `2.5px solid ${locked ? '#cbd5e1' : t.ring}` }}
    >
      {locked
        ? <Lock size={iconSize} strokeWidth={2.5} className="text-slate-300" />
        : <Medal size={iconSize} strokeWidth={2.5} className={t.icon} />}
    </div>
  )
}
