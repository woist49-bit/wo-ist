import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ACHIEVEMENTS, TIER_COLORS, TIER_BG } from '../lib/achievements'
import { Card } from '../components/ui/Card'
import type { PlayerAchievement } from '../types'

export function AchievementsPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const [earned, setEarned] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !worldId) return
    supabase.from('player_achievements').select('achievement_key').eq('user_id', user.id).eq('world_id', worldId)
      .then(({ data }) => {
        setEarned(new Set((data as PlayerAchievement[] ?? []).map(a => a.achievement_key)))
        setLoading(false)
      })
  }, [user, worldId])

  const tiers = ['gold', 'silver', 'bronze'] as const

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <h1 className="text-2xl font-bold text-white mb-1">Erfolge</h1>
      <p className="text-white/40 text-sm mb-6">{earned.size} / {ACHIEVEMENTS.length} freigeschaltet</p>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        tiers.map(tier => (
          <section key={tier} className="mb-6">
            <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${TIER_COLORS[tier]}`}>
              {tier === 'gold' ? '🥇 Gold' : tier === 'silver' ? '🥈 Silber' : '🥉 Bronze'}
            </h2>
            <div className="flex flex-col gap-2">
              {ACHIEVEMENTS.filter(a => a.tier === tier).map(a => {
                const unlocked = earned.has(a.key)
                return (
                  <Card key={a.key} className={`transition-all ${unlocked ? TIER_BG[tier] : 'opacity-40'}`}>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{unlocked ? tierEmoji(tier) : '🔒'}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${unlocked ? 'text-white' : 'text-white/60'}`}>{a.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">{a.description}</p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${TIER_COLORS[tier]}`}>+{a.xp_reward} XP</p>
                    </div>
                  </Card>
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
