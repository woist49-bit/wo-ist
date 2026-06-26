import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../stores/auth'
import { levelFromXp } from '../lib/scoring'
import { ACHIEVEMENTS } from '../lib/achievements'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'

export function ProfilePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'achievements' | 'stats'>('achievements')
  const [totalPoints, setTotalPoints] = useState(0)
  const [wins, setWins] = useState(0)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [attempts, setAttempts] = useState({ total: 0, finds: 0 })

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [lbRes, achRes, attRes] = await Promise.all([
        supabase.rpc('global_leaderboard'),
        supabase.from('player_achievements').select('achievement_key').eq('user_id', user.id),
        supabase.from('player_attempts').select('is_correct').eq('user_id', user.id),
      ])
      if (!active) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const myRow = (lbRes.data ?? []).find((r: any) => r.user_id === user.id)
      setTotalPoints(Number(myRow?.total_points ?? 0))
      setWins(Number(myRow?.wins ?? 0))
      setUnlocked(new Set((achRes.data ?? []).map(a => a.achievement_key)))
      const atts = attRes.data ?? []
      setAttempts({ total: atts.length, finds: atts.filter(a => a.is_correct).length })
    })()
    return () => { active = false }
  }, [user])

  if (!profile) return null

  const { level, xpIntoLevel, xpNeeded } = levelFromXp(profile.global_xp)
  const progress = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const initial = profile.username.slice(0, 1).toUpperCase()
  const hitRate = attempts.total ? Math.round((attempts.finds / attempts.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 flex flex-col animate-slide-in-right">
      {/* Fixer Hero-Bereich */}
      <div className="flex-shrink-0 bg-gradient-to-br from-sky-600 to-blue-800 rounded-b-[2rem] shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
        <div className="max-w-lg mx-auto px-4 pb-4">
          <div className="pt-2 pb-1 safe-top">
            <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
          </div>

          {/* Profilbild + Name nebeneinander */}
          <div className="flex items-center gap-4 mb-4 mt-1">
            <div className="w-16 h-16 rounded-2xl bg-violet-500 text-white text-2xl font-extrabold flex items-center justify-center shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d] flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-white truncate">{profile.username}</p>
              <p className="text-sky-100 font-bold text-sm">Level {level}</p>
            </div>
          </div>

          {/* Level-Leiste */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-sky-100/90 font-semibold mb-1">
              <span>XP bis Level {level + 1}</span>
              <span>{xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full shadow-[inset_0_1px_0_#ffffff80] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* 3 Kacheln */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <GameCard className="text-center !p-3">
              <p className="text-2xl font-extrabold text-slate-800">{totalPoints.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Punkte</p>
            </GameCard>
            <GameCard className="text-center !p-3">
              <p className="text-2xl font-extrabold text-yellow-500">{wins}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Siege</p>
            </GameCard>
            <GameCard className="text-center !p-3">
              <p className="text-2xl font-extrabold text-violet-500">{unlocked.size}/{ACHIEVEMENTS.length}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Erfolge</p>
            </GameCard>
          </div>

          {/* Tab-Auswahl */}
          <div className="flex rounded-2xl bg-[#efe2c4] p-1">
            {(['achievements', 'stats'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-violet-500 text-white shadow-[0_2px_0_#5b21b6]' : 'text-slate-500'}`}>
                {t === 'achievements' ? 'Achievements' : 'Statistiken'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollbar: nur die Liste */}
      <div className="flex-1 overflow-y-auto overscroll-none min-h-0 px-4 pb-8 pt-4">
        <div className="max-w-lg mx-auto">
          {tab === 'achievements' && (
            <div className="flex flex-col gap-2">
              {ACHIEVEMENTS.map(a => {
                const got = unlocked.has(a.key)
                const medal = a.tier === 'gold' ? '🥇' : a.tier === 'silver' ? '🥈' : '🥉'
                return (
                  <GameCard key={a.key} className={got ? '' : 'opacity-55'}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0 w-7 text-center">{got ? medal : '🔒'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-800">{a.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                      </div>
                      <p className="text-sm font-extrabold text-slate-400 flex-shrink-0">+{a.xp_reward}</p>
                    </div>
                  </GameCard>
                )
              })}
            </div>
          )}

          {tab === 'stats' && (
            <div className="flex flex-col gap-2">
              <StatRow label="Gesamtpunkte" value={totalPoints.toLocaleString()} />
              <StatRow label="Siege" value={wins} />
              <StatRow label="Achievements" value={`${unlocked.size} / ${ACHIEVEMENTS.length}`} />
              <StatRow label="Level" value={level} />
              <StatRow label="Gesamt-XP" value={profile.global_xp.toLocaleString()} />
              <StatRow label="Gespielte Bilder" value={attempts.total} />
              <StatRow label="Gefundene Bilder" value={attempts.finds} />
              <StatRow label="Trefferquote" value={attempts.total ? `${hitRate}%` : '–'} />
            </div>
          )}

          <Button variant="danger" className="w-full mt-6" onClick={async () => { await signOut(); navigate('/') }}>
            Abmelden
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <GameCard className="!py-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-600 font-semibold text-sm">{label}</span>
        <span className="text-slate-800 font-extrabold">{value}</span>
      </div>
    </GameCard>
  )
}
