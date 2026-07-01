import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../stores/toast'
import { signOut } from '../stores/auth'
import { levelFromXp } from '../lib/scoring'
import { ACHIEVEMENTS } from '../lib/achievements'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'
import type { Profile } from '../types'

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const targetId = userId ?? user?.id
  const isOwn = !!targetId && targetId === user?.id

  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<'achievements' | 'stats'>('achievements')
  const [totalPoints, setTotalPoints] = useState(0)
  const [wins, setWins] = useState(0)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [attempts, setAttempts] = useState({ total: 0, finds: 0 })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!targetId) return
    let active = true
    ;(async () => {
      const [profRes, lbRes, achRes, statRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetId).single(),
        supabase.rpc('global_leaderboard'),
        supabase.from('player_achievements').select('achievement_key').eq('user_id', targetId),
        supabase.rpc('user_play_stats', { p_user_id: targetId }),
      ])
      if (!active) return
      setProfile(profRes.data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = (lbRes.data ?? []).find((r: any) => r.user_id === targetId)
      setTotalPoints(Number(row?.total_points ?? 0))
      setWins(Number(row?.wins ?? 0))
      setUnlocked(new Set((achRes.data ?? []).map(a => a.achievement_key)))
      const s = (statRes.data ?? [])[0]
      setAttempts({ total: Number(s?.total ?? 0), finds: Number(s?.finds ?? 0) })
    })()
    return () => { active = false }
  }, [targetId])

  async function onAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { addToast('Bitte wähle eine Bilddatei.', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { addToast('Das Bild ist zu groß. Maximale Größe ist 5 MB.', 'error'); return }

    setUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `avatars/${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('game-images').upload(path, file, { upsert: true })
    if (upErr) { setUploading(false); addToast('Upload fehlgeschlagen.', 'error'); return }

    const url = supabase.storage.from('game-images').getPublicUrl(path).data.publicUrl
    const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    setUploading(false)
    if (dbErr) { addToast('Speichern fehlgeschlagen.', 'error'); return }

    setProfile(p => p ? { ...p, avatar_url: url } : p)
    refreshProfile() // Header & Co. aktualisieren
    addToast('Profilbild aktualisiert.', 'success')
  }

  if (!profile) return null

  const { level, xpIntoLevel, xpNeeded } = levelFromXp(profile.global_xp)
  const progress = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const hitRate = attempts.total ? Math.round((attempts.finds / attempts.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 flex flex-col animate-slide-in-right">
      {/* Fixer Hero-Bereich */}
      <div className="flex-shrink-0 bg-gradient-to-b from-sky-600 to-blue-800 rounded-b-[2rem] shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
        <div className="max-w-lg mx-auto px-4 pb-4">
          <div className="pt-2 pb-1 safe-top">
            <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
          </div>

          <div className="flex items-center gap-4 mb-4 mt-1">
            {isOwn ? (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative flex-shrink-0"
                aria-label="Profilbild ändern"
              >
                <Avatar url={profile.avatar_url} name={profile.username} className="w-16 h-16 rounded-2xl text-2xl shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d]" />
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                  {uploading
                    ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    : <Camera size={15} strokeWidth={2.5} />}
                </span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </button>
            ) : (
              <Avatar url={profile.avatar_url} name={profile.username} className="w-16 h-16 rounded-2xl text-2xl shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d]" />
            )}
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-white truncate">{profile.username}</p>
              <p className="text-sky-100 font-bold text-sm">Level {level}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-xs text-sky-100/90 font-semibold mb-1">
              <span>XP bis Level {level + 1}</span>
              <span>{xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full shadow-[inset_0_1px_0_#ffffff80] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

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

          <div className="flex rounded-2xl bg-[#efe2c4] p-1">
            {(['achievements', 'stats'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-violet-500 text-white shadow-[0_2px_0_#5b21b6]' : 'text-slate-500'}`}>
                {t === 'achievements' ? 'Achievements' : 'Statistiken'}
              </button>
            ))}
          </div>
        </div>
      </div>

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

          {isOwn && (
            <>
              <Button variant="danger" className="w-full mt-6" onClick={async () => { await signOut(); navigate('/') }}>
                Abmelden
              </Button>
              <button onClick={() => navigate('/datenschutz')} className="block mx-auto mt-5 text-white/30 hover:text-white/50 text-xs transition-colors">
                Datenschutzerklärung
              </button>
            </>
          )}
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
