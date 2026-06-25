import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/ui/Card'
import { levelFromXp } from '../lib/scoring'
import type { LiveEvent, EventImage, PlayerAttempt, EventLeaderboardEntry } from '../types'

export function EventPage() {
  const { worldId, eventId } = useParams<{ worldId: string; eventId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
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
    const now = new Date()
    const unlocked = (imgRes.data ?? []).filter((img: EventImage) => new Date(img.unlocks_at) <= now)
    setImages(unlocked)
    const map = new Map<string, PlayerAttempt>()
    for (const a of attRes.data ?? []) map.set(a.image_id, a)
    setAttempts(map)
    setBoard(boardRes.data ?? [])
    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (!event) return <div className="p-8 text-center text-white/50">Event nicht gefunden.</div>

  const totalPoints = Array.from(attempts.values()).reduce((s, a) => s + a.points, 0)

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <button onClick={() => navigate(`/world/${worldId}`)} className="text-white/40 text-sm mb-4 hover:text-white/70">← Zurück</button>
      <h1 className="text-2xl font-bold text-white mb-1">{event.title}</h1>
      <p className="text-white/40 text-sm mb-2">{formatDateRange(event.starts_at, event.ends_at)}</p>
      <p className="text-indigo-400 font-semibold mb-6">Deine Punkte: {totalPoints}</p>

      {images.length === 0 ? (
        <Card className="text-center py-12 text-white/40">
          <p className="text-4xl mb-3">⏳</p>
          <p>Noch kein Bild freigeschaltet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {images.map((img, idx) => {
            const att = attempts.get(img.id)
            const played = !!att
            return (
              <button key={img.id} onClick={() => navigate(`/world/${worldId}/event/${eventId}/image/${img.id}`)} className="w-full text-left">
                <Card className={`hover:bg-white/10 transition-colors overflow-hidden ${played ? 'border-white/5' : 'border-indigo-500/30'}`}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      {!played && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="text-2xl">🔍</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">Bild {idx + 1}</p>
                      <p className="text-xs text-white/40">{formatDate(img.unlocks_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {played ? (
                        <div className={att.is_correct ? 'text-green-400' : 'text-red-400'}>
                          <p className="font-bold">{att.is_correct ? `+${att.points}` : '✗'}</p>
                          <p className="text-xs opacity-70">{att.time_seconds}s</p>
                        </div>
                      ) : (
                        <span className="text-indigo-400 text-sm font-medium">Spielen →</span>
                      )}
                    </div>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      <h2 className="text-lg font-bold text-white mt-8 mb-3">🏆 Event-Rangliste</h2>
      {board.length === 0 ? (
        <Card className="text-center py-8 text-white/40 text-sm">Noch keine Punkte gesammelt.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {board.map((entry, idx) => {
            const isMe = entry.user_id === user?.id
            const { level } = levelFromXp(entry.xp)
            const badge = idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/60'
            return (
              <Card key={entry.user_id} className={isMe ? 'border-indigo-500/60 bg-indigo-900/20' : ''}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${badge}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                      {entry.username} {isMe && '(Du)'}
                    </p>
                    <p className="text-xs text-white/40">Lvl {level} · {entry.finds} {entry.finds === 1 ? 'Fund' : 'Funde'}</p>
                  </div>
                  <p className="font-bold text-white text-lg flex-shrink-0">{entry.total_points.toLocaleString()}</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
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
