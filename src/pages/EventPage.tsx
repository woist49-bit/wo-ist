import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNow } from '../hooks/useNow'
import { levelFromXp } from '../lib/scoring'
import { formatCountdown, relativeDay, IMAGE_PLAY_WINDOW_MS } from '../lib/time'
import { GameCard } from '../components/ui/GameCard'
import type { LiveEvent, EventImage, PlayerAttempt, EventLeaderboardEntry } from '../types'

export function EventPage() {
  const { worldId, eventId } = useParams<{ worldId: string; eventId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [event, setEvent] = useState<LiveEvent | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  const [attempts, setAttempts] = useState<Map<string, PlayerAttempt>>(new Map())
  const [board, setBoard] = useState<EventLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (eventId && user) load() }, [eventId, user])

  async function load() {
    const [evRes, imgRes, attRes, boardRes] = await Promise.all([
      supabase.from('live_events').select('*').eq('id', eventId).single(),
      supabase.from('event_images').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('player_attempts').select('*').eq('user_id', user!.id).in('image_id',
        (await supabase.from('event_images').select('id').eq('event_id', eventId)).data?.map(r => r.id) ?? []
      ),
      supabase.rpc('event_leaderboard', { p_event_id: eventId }),
    ])
    setEvent(evRes.data)
    setImages((imgRes.data ?? []) as EventImage[])
    const map = new Map<string, PlayerAttempt>()
    for (const a of attRes.data ?? []) map.set(a.image_id, a)
    setAttempts(map)
    setBoard(boardRes.data ?? [])
    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (!event) return <div className="p-8 text-center text-white/50">Event nicht gefunden.</div>

  const totalPoints = Array.from(attempts.values()).reduce((s, a) => s + a.points, 0)
  const unlockedImages = images.filter(img => new Date(img.unlocks_at).getTime() <= now)
  const nextImage = images
    .filter(img => new Date(img.unlocks_at).getTime() > now)
    .sort((a, b) => new Date(a.unlocks_at).getTime() - new Date(b.unlocks_at).getTime())[0] ?? null
  const eventEnded = now > new Date(event.ends_at).getTime()

  return (
    <div className="p-4 max-w-lg mx-auto pt-5 pb-8">
      <h1 className="text-2xl font-extrabold text-white mb-1">{event.title}</h1>
      <p className="text-white/50 text-sm mb-3">{formatDateRange(event.starts_at, event.ends_at)}</p>
      <div className="inline-block bg-amber-400 text-amber-950 font-extrabold text-sm rounded-full px-4 py-1.5 mb-5 shadow-[0_3px_0_#b45309,inset_0_1px_0_#ffffff80]">
        Deine Punkte: {totalPoints.toLocaleString()}
      </div>

      {unlockedImages.length === 0 ? (
        <GameCard className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">⏳</p>
          <p className="font-semibold">Noch kein Bild freigeschaltet.</p>
        </GameCard>
      ) : (
        <div className="flex flex-col gap-3">
          {unlockedImages.map((img, idx) => {
            const att = attempts.get(img.id)
            const played = !!att
            const remaining = new Date(img.unlocks_at).getTime() + IMAGE_PLAY_WINDOW_MS - now
            const expired = remaining <= 0
            const remainColor = expired ? 'text-slate-400' : remaining < 3600000 ? 'text-amber-600' : 'text-emerald-600'
            return (
              <button
                key={img.id}
                onClick={() => navigate(`/world/${worldId}/event/${eventId}/image/${img.id}`)}
                className="w-full text-left active:translate-y-[2px] transition-transform"
              >
                <GameCard className={played ? '' : expired ? 'opacity-70' : '!border-violet-400'}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-300 flex-shrink-0">
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      {!played && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                          <Search size={20} strokeWidth={2.5} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-800">Bild {idx + 1}</p>
                      {img.description && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{img.description}</p>}
                      <p className="text-xs text-slate-500 mt-0.5">Freigeschaltet: {formatDate(img.unlocks_at)}</p>
                      {!played && (
                        <p className={`text-xs font-bold mt-0.5 ${remainColor}`}>
                          {expired ? 'Abgelaufen' : `Noch ${formatCountdown(remaining)} spielbar`}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 text-sm font-bold">
                      {played ? (
                        att.is_correct ? (
                          <>
                            <span className="text-green-600">+{att.points}</span>
                            <p className="text-[11px] text-slate-400 font-semibold">{att.time_seconds}s</p>
                          </>
                        ) : (
                          <span className="text-red-500">✗ Daneben</span>
                        )
                      ) : expired ? (
                        <span className="text-slate-400">Abgelaufen</span>
                      ) : (
                        <span className="text-violet-600">Spielen →</span>
                      )}
                    </div>
                  </div>
                </GameCard>
              </button>
            )
          })}
        </div>
      )}

      {/* Info zum nächsten Bild bzw. Event-Ende */}
      {images.length > 0 && (
        nextImage ? (
          <GameCard className="mt-4 !py-3">
            <div className="flex items-center gap-3">
              <Clock size={20} strokeWidth={2.5} className="text-violet-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-slate-700">
                Nächstes Bild {relativeDay(new Date(nextImage.unlocks_at), new Date(now))} um {timeOf(nextImage.unlocks_at)} Uhr
                <span className="text-slate-400"> · in {formatCountdown(new Date(nextImage.unlocks_at).getTime() - now)}</span>
              </p>
            </div>
          </GameCard>
        ) : (
          <GameCard className="mt-4 !py-3 text-center text-sm font-semibold text-slate-500">
            {eventEnded ? 'Dieses Event ist beendet.' : 'Das war das letzte Bild – das Event läuft bald aus.'}
          </GameCard>
        )
      )}

      <h2 className="text-lg font-extrabold text-white mt-8 mb-3">🏆 Event-Rangliste</h2>
      {board.length === 0 ? (
        <GameCard className="text-center py-8 text-slate-400 text-sm font-semibold">Noch keine Punkte gesammelt.</GameCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {board.map((entry, idx) => {
            const isMe = entry.user_id === user?.id
            const { level } = levelFromXp(entry.xp)
            return (
              <GameCard key={entry.user_id} className={`!py-3 ${isMe ? '!border-violet-400' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-[inset_0_1px_0_#ffffff80] ${rankBadge(idx)}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-800 truncate">{entry.username}</span>
                      {isMe && <span className="text-xs text-slate-400 flex-shrink-0">(Du)</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Lvl {level} · {entry.finds} {entry.finds === 1 ? 'Fund' : 'Funde'}</p>
                  </div>
                  <p className="font-extrabold text-slate-800 text-lg flex-shrink-0">{entry.total_points.toLocaleString()}</p>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

const rankBadge = (idx: number) =>
  idx === 0 ? 'bg-yellow-400 text-yellow-900'
  : idx === 1 ? 'bg-slate-300 text-slate-700'
  : idx === 2 ? 'bg-amber-600 text-white'
  : 'bg-slate-200 text-slate-500'

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const e = new Date(end).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return `${s} – ${e}`
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
