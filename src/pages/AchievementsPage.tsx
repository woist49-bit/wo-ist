import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ACHIEVEMENTS } from '../lib/achievements'
import { GameCard } from '../components/ui/GameCard'
import { LiveOnlyChip } from '../components/ui/LiveOnlyChip'
import type { PlayerAchievement } from '../types'

// Auf dem beigen GameCard lesbare Tier-Farben (die globalen TIER_COLORS sind für dunklen Grund).
const TIER_TEXT = { gold: 'text-yellow-600', silver: 'text-slate-500', bronze: 'text-amber-700' }
const TIER_HEAD = { gold: 'text-yellow-300', silver: 'text-slate-300', bronze: 'text-amber-400' }

export function AchievementsPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const [earned, setEarned] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !worldId) return
    // Achievements gelten global pro Spieler (nicht mehr pro Spielwelt) -> kein world_id-Filter
    supabase.from('player_achievements').select('achievement_key').eq('user_id', user.id)
      .then(({ data }) => {
        setEarned(new Set((data as PlayerAchievement[] ?? []).map(a => a.achievement_key)))
        setLoading(false)
      })
  }, [user, worldId])

  const tiers = ['gold', 'silver', 'bronze'] as const
  // Globale Erfolge (z. B. Tutorial) gehören zu keiner Spielwelt -> hier nicht listen
  const worldAchievements = ACHIEVEMENTS.filter(a => !a.global)

  return (
    <div className="p-4 max-w-lg mx-auto pt-5 pb-8">
      <h1 className="text-2xl font-extrabold text-white mb-1">Erfolge</h1>
      <p className="text-white/50 text-sm mb-6">{worldAchievements.filter(a => earned.has(a.key)).length} / {worldAchievements.length} freigeschaltet</p>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        tiers.map(tier => (
          <section key={tier} className="mb-6">
            <h2 className={`text-sm font-extrabold uppercase tracking-wider mb-3 ${TIER_HEAD[tier]}`}>
              {tier === 'gold' ? '🥇 Gold' : tier === 'silver' ? '🥈 Silber' : '🥉 Bronze'}
            </h2>
            <div className="flex flex-col gap-2">
              {worldAchievements.filter(a => a.tier === tier).map(a => {
                const unlocked = earned.has(a.key)
                return (
                  <GameCard key={a.key} className={unlocked ? '' : 'opacity-55'}>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl flex-shrink-0 w-7 text-center">{unlocked ? tierEmoji(tier) : '🔒'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-800">{a.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                        {a.liveOnly && <div className="mt-1.5"><LiveOnlyChip /></div>}
                      </div>
                      <p className={`text-sm font-extrabold flex-shrink-0 ${unlocked ? TIER_TEXT[tier] : 'text-slate-400'}`}>+{a.xp_reward} XP</p>
                    </div>
                  </GameCard>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function tierEmoji(tier: 'bronze' | 'silver' | 'gold') {
  return tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : '🥉'
}
