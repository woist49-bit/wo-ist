import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../stores/auth'
import { levelFromXp } from '../lib/scoring'
import { ACHIEVEMENT_MAP, TIER_COLORS, TIER_BG } from '../lib/achievements'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import type { PlayerAchievement } from '../types'

export function ProfilePage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])

  useEffect(() => {
    if (user && worldId) loadAchievements()
  }, [user, worldId])

  if (!profile) return null

  const { level, xpIntoLevel, xpNeeded } = levelFromXp(profile.global_xp)
  const progress = (xpIntoLevel / xpNeeded) * 100

  // Globale Profil-Seite (ohne Achievements einer spezifischen Welt)
  if (!worldId) {
    return (
      <div className="p-4 max-w-lg mx-auto pt-6">
        <h1 className="text-2xl font-bold text-white mb-6">Profil</h1>

        <Card className="mb-4 text-center py-6">
          <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-3 text-3xl font-bold text-white">
            {profile.username.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xl font-bold text-white">{profile.username}</p>
          <p className="text-white/50 text-sm mt-1">Level {level}</p>
        </Card>

        <Card className="mb-4">
          <div className="flex justify-between text-sm text-white/50 mb-2">
            <span>XP</span>
            <span>{xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()}</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-white/30 mt-1 text-right">Gesamt: {profile.global_xp.toLocaleString()} XP</p>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="text-center py-4">
            <p className="text-3xl font-bold text-yellow-400">{profile.global_wins}</p>
            <p className="text-white/50 text-sm mt-1">Siege</p>
          </Card>
          <Card className="text-center py-4">
            <p className="text-3xl font-bold text-indigo-400">{level}</p>
            <p className="text-white/50 text-sm mt-1">Level</p>
          </Card>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={async () => { await signOut(); navigate('/') }}
        >
          Abmelden
        </Button>
      </div>
    )
  }

  async function loadAchievements() {
    const { data } = await supabase.from('player_achievements').select('*').eq('user_id', user!.id).eq('world_id', worldId)
    setAchievements(data ?? [])
  }

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <h1 className="text-2xl font-bold text-white mb-6">Profil</h1>

      <Card className="mb-4 text-center py-6">
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-3 text-3xl font-bold text-white">
          {profile.username.slice(0, 1).toUpperCase()}
        </div>
        <p className="text-xl font-bold text-white">{profile.username}</p>
        <p className="text-white/50 text-sm mt-1">Level {level}</p>
      </Card>

      <Card className="mb-4">
        <div className="flex justify-between text-sm text-white/50 mb-2">
          <span>XP</span>
          <span>{xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()}</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-white/30 mt-1 text-right">Gesamt: {profile.global_xp.toLocaleString()} XP</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="text-center py-4">
          <p className="text-3xl font-bold text-yellow-400">{profile.global_wins}</p>
          <p className="text-white/50 text-sm mt-1">Siege</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-3xl font-bold text-indigo-400">{level}</p>
          <p className="text-white/50 text-sm mt-1">Level</p>
        </Card>
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Erfolge in dieser Welt ({achievements.length})</h2>
      {achievements.length === 0 ? (
        <Card className="text-center py-6 text-white/40 text-sm">Noch keine Erfolge freigeschaltet</Card>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {achievements.map(ach => {
            const achievement = ACHIEVEMENT_MAP[ach.achievement_key]
            if (!achievement) return null
            return (
              <Card key={ach.id} className={`${TIER_BG[achievement.tier]}`}>
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {achievement.tier === 'gold' ? '🥇' : achievement.tier === 'silver' ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${TIER_COLORS[achievement.tier]}`}>{achievement.name}</p>
                    <p className="text-xs text-white/50 mt-0.5">{achievement.description}</p>
                    <p className="text-xs text-white/30 mt-1">{new Date(ach.earned_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${TIER_COLORS[achievement.tier]}`}>+{achievement.xp_reward} XP</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Button
        variant="danger"
        className="w-full"
        onClick={async () => { await signOut(); navigate('/') }}
      >
        Abmelden
      </Button>
    </div>
  )
}
