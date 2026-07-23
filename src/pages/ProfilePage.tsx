import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Camera, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../stores/toast'
import { signOut, setUsername } from '../stores/auth'
import { Input } from '../components/ui/Input'
import { levelFromXp } from '../lib/scoring'
import { ACHIEVEMENTS } from '../lib/achievements'
import { FramedAvatar } from '../components/ui/FramedAvatar'
import { MedalBadge } from '../components/ui/MedalBadge'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'
import { PushToggle } from '../components/PushToggle'
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
  const [stats, setStats] = useState<{ total: number; finds: number; avgSeconds: number | null; campaigns: number; events: number }>(
    { total: 0, finds: 0, avgSeconds: null, campaigns: 0, events: 0 },
  )
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Benutzername ändern (nur eigenes Profil)
  const [showRename, setShowRename] = useState(false)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState('')

  async function saveUsername() {
    setRenaming(true); setRenameError('')
    const { error } = await setUsername(newName)
    setRenaming(false)
    if (error) { setRenameError(error); return }
    setShowRename(false)
    await load()        // Anzeige auf dieser Seite
    refreshProfile()    // Header und Rest der App
    addToast('Benutzername geändert.', 'success')
  }

  // Sequenz-Guard: nur das Ergebnis des jeweils jüngsten load() wird übernommen
  // (schützt vor Races bei targetId-Wechsel, Unmount und Fokus-Refetch).
  const loadSeq = useRef(0)
  const load = useCallback(async () => {
    if (!targetId) return
    const seq = ++loadSeq.current
    const [profRes, totalsRes, achRes, statRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetId).single(),
      supabase.rpc('user_totals', { p_user_id: targetId }),
      supabase.from('player_achievements').select('achievement_key').eq('user_id', targetId),
      supabase.rpc('user_play_stats', { p_user_id: targetId }),
    ])
    if (seq !== loadSeq.current) return // veraltet -> verwerfen
    setProfile(profRes.data)
    const t = (totalsRes.data ?? [])[0]
    setTotalPoints(Number(t?.total_points ?? 0))
    setWins(Number(t?.wins ?? 0))
    setUnlocked(new Set((achRes.data ?? []).map(a => a.achievement_key)))
    const s = (statRes.data ?? [])[0]
    setStats({
      total: Number(s?.total ?? 0),
      finds: Number(s?.finds ?? 0),
      avgSeconds: s?.avg_find_seconds != null ? Number(s.avg_find_seconds) : null,
      campaigns: Number(s?.completed_campaigns ?? 0),
      events: Number(s?.completed_events ?? 0),
    })
  }, [targetId])

  useEffect(() => {
    load()
    return () => { loadSeq.current++ } // laufende load()-Aufrufe invalidieren
  }, [load])

  // Bei Rückkehr in die App / auf den Tab frisch nachladen, damit gerade
  // freigeschaltete Erfolge und aktualisierte Statistiken sofort erscheinen.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

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
  const hitRate = stats.total ? Math.round((stats.finds / stats.total) * 100) : 0

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
                <FramedAvatar url={profile.avatar_url} name={profile.username} frame={profile.equipped_frame} size={64} paused={false} className="text-2xl shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d]" />
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.3)] z-10">
                  {uploading
                    ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    : <Camera size={15} strokeWidth={2.5} />}
                </span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </button>
            ) : (
              <FramedAvatar url={profile.avatar_url} name={profile.username} frame={profile.equipped_frame} size={64} paused={false} className="text-2xl shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d]" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xl font-extrabold text-white truncate">{profile.username}</p>
                {isOwn && (
                  <button
                    onClick={() => { setNewName(profile.username); setRenameError(''); setShowRename(true) }}
                    aria-label="Benutzernamen ändern"
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Pencil size={13} strokeWidth={2.75} />
                  </button>
                )}
              </div>
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
                return (
                  <GameCard key={a.key} className={got ? '' : 'opacity-55'}>
                    <div className="flex items-center gap-3">
                      <MedalBadge tier={a.tier} locked={!got} size={40} />
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
              <StatRow label="Gespielte Bilder" value={stats.total} />
              <StatRow label="Gefundene Bilder" value={stats.finds} />
              <StatRow label="Trefferquote" value={stats.total ? `${hitRate}%` : '–'} />
              <StatRow label="Ø Suchzeit" value={formatSeconds(stats.avgSeconds)} />
              <StatRow label="Abgeschlossene Kampagnen" value={stats.campaigns} />
              <StatRow label="Abgeschlossene Live-Events" value={stats.events} />
            </div>
          )}

          {isOwn && (
            <>
              <PushToggle userId={user!.id} />
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

      {showRename && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <GameCard className="w-full max-w-sm">
            <p className="font-extrabold text-slate-800 text-lg mb-1">Benutzername ändern</p>
            <p className="text-slate-600 text-sm mb-3">
              Dein Name ist überall sichtbar – in Ranglisten, Erfolgen und Spielwelten. Er muss
              eindeutig sein.
            </p>
            <Input
              tone="light"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Dein Name"
              maxLength={20}
              autoFocus
            />
            {renameError && <p className="text-red-600 text-sm font-medium mt-2">{renameError}</p>}
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowRename(false)}>Abbrechen</Button>
              <Button
                variant="success"
                className="flex-1"
                loading={renaming}
                disabled={!newName.trim() || newName.trim() === profile.username}
                onClick={saveUsername}
              >
                Speichern
              </Button>
            </div>
          </GameCard>
        </div>
      )}
    </div>
  )
}

// Durchschnittliche Suchzeit lesbar: "42 s" bzw. "3:07 min" (null -> "–")
function formatSeconds(s: number | null): string {
  if (s == null) return '–'
  const total = Math.round(s)
  if (total < 60) return `${total} s`
  const m = Math.floor(total / 60)
  const rest = total % 60
  return `${m}:${String(rest).padStart(2, '0')} min`
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
