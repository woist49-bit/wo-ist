import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, Clock, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNow } from '../hooks/useNow'
import { useToast } from '../stores/toast'
import { levelFromXp } from '../lib/scoring'
import { getShopItem } from '../lib/shop'
import { formatCountdown, relativeDay, IMAGE_PLAY_WINDOW_MS } from '../lib/time'
import { GameCard } from '../components/ui/GameCard'
import { FramedAvatar } from '../components/ui/FramedAvatar'
import { EventImagePopup, type ImageStatus } from '../components/event/EventImagePopup'
import type { LiveEvent, EventImage, PlayerAttempt, EventLeaderboardEntry } from '../types'

// Aggregierte Item-/Debuff-Anzeige pro Spieler (über alle Bilder des Events)
interface UserItemAgg {
  items: { key: string; count: number }[]                       // grün: selbst eingesetzt
  debuffs: { type: string; count: number; senders: string[] }[] // rot: von anderen erhalten
}
interface ItemLogRow { user_id: string; items_used: string[] | null; debuffs_received: { debuff_type: string; stacks: number; sender: string }[] | null }

export function EventPage() {
  const { worldId, eventId } = useParams<{ worldId: string; eventId: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [event, setEvent] = useState<LiveEvent | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  const [attempts, setAttempts] = useState<Map<string, PlayerAttempt>>(new Map())
  const [board, setBoard] = useState<EventLeaderboardEntry[]>([])
  const [inventory, setInventory] = useState<Map<string, number>>(new Map())
  const [avatars, setAvatars] = useState<Map<string, string | null>>(new Map())
  const [frames, setFrames] = useState<Map<string, string | null>>(new Map())
  const [itemLog, setItemLog] = useState<Map<string, UserItemAgg>>(new Map())
  const [popupImg, setPopupImg] = useState<EventImage | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)   // Admin dieser Welt -> spielt nicht, verwaltet
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (eventId && user) load() }, [eventId, user])

  async function load() {
    const [evRes, imgRes, attRes, boardRes, invRes, logRes, roleRes] = await Promise.all([
      supabase.from('live_events').select('*').eq('id', eventId).single(),
      supabase.from('event_images').select('*').eq('event_id', eventId).order('unlocks_at', { ascending: true }).order('sort_order', { ascending: true }),
      supabase.from('player_attempts').select('*').eq('user_id', user!.id).in('image_id',
        (await supabase.from('event_images').select('id').eq('event_id', eventId)).data?.map(r => r.id) ?? []
      ),
      supabase.rpc('event_leaderboard', { p_event_id: eventId }),
      supabase.from('player_inventory').select('item_key, quantity').eq('player_id', user!.id),
      supabase.rpc('event_item_log', { p_event_id: eventId }),
      supabase.from('world_members').select('role').eq('world_id', worldId).eq('user_id', user!.id).maybeSingle(),
    ])
    setIsAdmin(roleRes.data?.role === 'admin')
    setEvent(evRes.data)
    setImages((imgRes.data ?? []) as EventImage[])
    const map = new Map<string, PlayerAttempt>()
    for (const a of attRes.data ?? []) map.set(a.image_id, a)
    setAttempts(map)
    const boardRows = (boardRes.data ?? []) as EventLeaderboardEntry[]
    setBoard(boardRows)
    setInventory(new Map((invRes.data ?? []).map(r => [r.item_key, r.quantity])))

    // Profilbilder werden von event_leaderboard nicht geliefert -> separat nachladen (wie in der Spielwelt-Rangliste)
    const ids = boardRows.map(r => r.user_id)
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, avatar_url, equipped_frame').in('id', ids)
      const m = new Map<string, string | null>()
      const fm = new Map<string, string | null>()
      for (const p of profs ?? []) { m.set(p.id, p.avatar_url); fm.set(p.id, p.equipped_frame) }
      setAvatars(m)
      setFrames(fm)
    }

    // Item-Log (Phase 7) pro Spieler über alle Bilder aggregieren
    setItemLog(aggregateItemLog((logRes.data ?? []) as ItemLogRow[]))
    setLoading(false)
  }

  // Inventar allein neu laden (nach Debuff-Einsatz, ohne das ganze Popup zu schließen)
  async function reloadInventory() {
    const { data } = await supabase.from('player_inventory').select('item_key, quantity').eq('player_id', user!.id)
    setInventory(new Map((data ?? []).map(r => [r.item_key, r.quantity])))
  }

  if (loading) return <LoadingScreen />
  if (!event) return <div className="p-8 text-center text-white/50">Event nicht gefunden.</div>

  const totalPoints = Array.from(attempts.values()).reduce((s, a) => s + a.points, 0)

  // Fester Zeitplan: jeder Tag von Start bis Ende zur täglichen Freigabezeit ist ein "Slot".
  const slots = buildSlots(event)
  const lastUnlockMs = images.length ? Math.max(...images.map(i => new Date(i.unlocks_at).getTime())) : 0
  // Event endet am Enddatum + 24h (letztes Bild am letzten Tag ist 24h spielbar);
  // gehen Bilder über das Enddatum hinaus, zählt das späteste Bild + 24h.
  const eventEndMs = Math.max(lastUnlockMs, new Date(event.ends_at).getTime()) + IMAGE_PLAY_WINDOW_MS
  const trulyOver = now >= eventEndMs
  // Nächster geplanter Tag (unabhängig davon, ob schon ein Bild hochgeladen wurde)
  const nextSlot = slots.find(s => s > now) ?? null
  // Vergangene Tage ohne veröffentlichtes Bild (2 Bilder an einem Tag ändern nichts)
  const gapDays = slots.filter(s => s <= now && !images.some(img => sameDayMs(new Date(img.unlocks_at).getTime(), s)))

  return (
    <div className="p-4 max-w-lg mx-auto pt-5 pb-8">
      <h1 className="text-2xl font-extrabold text-white mb-1">{event.title}</h1>
      <p className="text-white/50 text-sm mb-3">{formatDateRange(event.starts_at, event.ends_at)}</p>
      {isAdmin ? (
        <div className="inline-block bg-sky-500 text-white font-extrabold text-sm rounded-full px-4 py-1.5 mb-5 shadow-[0_3px_0_#0369a1,inset_0_1px_0_#ffffff80]">
          👑 Admin – du verwaltest dieses Event
        </div>
      ) : (
        <div className="inline-block bg-amber-400 text-amber-950 font-extrabold text-sm rounded-full px-4 py-1.5 mb-5 shadow-[0_3px_0_#b45309,inset_0_1px_0_#ffffff80]">
          Deine Punkte: {totalPoints.toLocaleString()}
        </div>
      )}

      {images.length === 0 ? (
        <GameCard className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">⏳</p>
          <p className="font-semibold">Noch keine Bilder in diesem Event.</p>
        </GameCard>
      ) : (
        <div className="flex flex-col gap-3">
          {images.map((img, idx) => {
            const att = attempts.get(img.id)
            const played = !!att
            const unlockMs = new Date(img.unlocks_at).getTime()
            const locked = unlockMs > now
            const remaining = unlockMs + IMAGE_PLAY_WINDOW_MS - now
            const expired = !locked && remaining <= 0
            const remainColor = expired ? 'text-slate-400' : remaining < 3600000 ? 'text-amber-600' : 'text-emerald-600'
            return (
              <button
                key={img.id}
                onClick={() => isAdmin
                  ? navigate(`/world/${worldId}/admin/event/${eventId}/image/${img.id}`)
                  : setPopupImg(img)}
                className="w-full text-left active:translate-y-[2px] transition-transform"
              >
                <GameCard className={isAdmin ? '!border-sky-300' : played ? '' : locked ? '' : expired ? 'opacity-70' : '!border-violet-400'}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-300 flex-shrink-0 flex items-center justify-center">
                      {locked ? (
                        <Lock size={22} strokeWidth={2.5} className="text-slate-500" />
                      ) : (
                        <>
                          {/* Noch nicht gespielt -> unscharf, damit man nicht vorab suchen kann */}
                          <img src={img.image_url} alt="" className={`w-full h-full object-cover ${!played ? 'blur-[5px] scale-110' : ''}`} />
                          {!played && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                              <Search size={20} strokeWidth={2.5} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-800">Bild {idx + 1}</p>
                      {locked ? (
                        <p className="text-xs font-bold mt-0.5 text-violet-600">Freigeschaltet in {formatCountdown(unlockMs - now)}</p>
                      ) : (
                        <>
                          {img.description && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{img.description}</p>}
                          <p className="text-xs text-slate-500 mt-0.5">Freigeschaltet: {formatDate(img.unlocks_at)}</p>
                          {!played && (
                            <p className={`text-xs font-bold mt-0.5 ${remainColor}`}>
                              {expired ? 'Abgelaufen' : `Noch ${formatCountdown(remaining)} spielbar`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 text-sm font-bold">
                      {isAdmin ? (
                        <span className="text-sky-600">Verwalten →</span>
                      ) : locked ? (
                        <span className="text-slate-400 inline-flex items-center gap-1"><Lock size={14} strokeWidth={2.5} /> Gesperrt</span>
                      ) : played ? (
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

      {/* Tage, an denen kein Bild veröffentlicht wurde */}
      {gapDays.length > 0 && (
        <GameCard className="mt-4 !py-3 !border-amber-300">
          <div className="flex items-start gap-3">
            <Clock size={20} strokeWidth={2.5} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-slate-700">
              {gapDays.length === 1 ? 'An diesem Tag' : 'An diesen Tagen'} wurde kein Bild veröffentlicht:{' '}
              <span className="text-slate-500">{gapDays.map(g => dayLabel(g)).join(', ')}</span>
            </p>
          </div>
        </GameCard>
      )}

      {/* Event-Status: Enddatum + 24h, nicht das letzte Bild */}
      <GameCard className="mt-3 !py-3">
        {trulyOver ? (
          <p className="text-center text-sm font-semibold text-slate-500">Dieses Event ist beendet.</p>
        ) : nextSlot ? (
          <div className="flex items-center gap-3">
            <Clock size={20} strokeWidth={2.5} className="text-violet-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-700">
              Nächstes Bild {relativeDay(new Date(nextSlot), new Date(now))} um {timeOf(nextSlot)} Uhr
              <span className="text-slate-400"> · in {formatCountdown(nextSlot - now)}</span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Clock size={20} strokeWidth={2.5} className="text-violet-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-700">
              Letztes Bild ist da – Event endet in {formatCountdown(eventEndMs - now)}
            </p>
          </div>
        )}
      </GameCard>

      <h2 className="text-lg font-extrabold text-white mt-8 mb-3">🏆 Event-Rangliste</h2>
      {board.length === 0 ? (
        <GameCard className="text-center py-8 text-slate-400 text-sm font-semibold">Noch keine Punkte gesammelt.</GameCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {board.map((entry, idx) => {
            const isMe = entry.user_id === user?.id
            const { level } = levelFromXp(entry.xp)
            const agg = itemLog.get(entry.user_id)
            return (
              <div
                key={entry.user_id}
                onClick={() => navigate(`/world/${worldId}/profile/${entry.user_id}`)}
                className="w-full text-left active:translate-y-[2px] transition-transform cursor-pointer"
              >
                <GameCard className={`!py-3 ${isMe ? '!border-violet-400' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <FramedAvatar url={avatars.get(entry.user_id) ?? null} name={entry.username} frame={frames.get(entry.user_id) ?? null} size={44} paused={false} className="text-lg shadow-[inset_0_2px_0_#ffffff33]" />
                      <span className={`absolute -top-1.5 -left-1.5 min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center font-extrabold text-[11px] ring-2 ring-[#fdf6e3] shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${rankBadge(idx)}`}>
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800 truncate">{entry.username}</span>
                        {isMe && <span className="text-xs text-slate-400 flex-shrink-0">(Du)</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Lvl {level} · {entry.finds} {entry.finds === 1 ? 'Fund' : 'Funde'}</p>
                      {agg && (agg.items.length > 0 || agg.debuffs.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {agg.items.map(it => (
                            <ItemChip
                              key={`i-${it.key}`} itemKey={it.key} count={it.count} tone="good"
                              onTap={() => addToast(`${getShopItem(it.key)?.name ?? it.key}${it.count > 1 ? ` ×${it.count}` : ''} eingesetzt`, 'info', 4000)}
                            />
                          ))}
                          {agg.debuffs.map(d => {
                            const senders = Array.from(new Set(d.senders))
                            return (
                              <ItemChip
                                key={`d-${d.type}`} itemKey={d.type} count={d.count} tone="bad"
                                onTap={() => addToast(`${getShopItem(d.type)?.name ?? d.type}${d.count > 1 ? ` ×${d.count}` : ''}${senders.length ? ` von ${senders.join(', ')}` : ''}`, 'info', 5000)}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <p className="font-extrabold text-slate-800 text-lg flex-shrink-0">{entry.total_points.toLocaleString()}</p>
                  </div>
                </GameCard>
              </div>
            )
          })}
        </div>
      )}

      {popupImg && (() => {
        const att = attempts.get(popupImg.id) ?? null
        const status: ImageStatus = att ? 'played' : new Date(popupImg.unlocks_at).getTime() > now ? 'locked' : 'open'
        const idx = images.findIndex(i => i.id === popupImg.id)
        return (
          <EventImagePopup
            image={popupImg}
            index={idx}
            status={status}
            attempt={att}
            inventory={inventory}
            onClose={() => setPopupImg(null)}
            onPlay={() => navigate(`/world/${worldId}/event/${eventId}/image/${popupImg.id}`)}
            onViewResult={() => navigate(`/world/${worldId}/event/${eventId}/image/${popupImg.id}`)}
            onChanged={reloadInventory}
          />
        )
      })()}
    </div>
  )
}

const rankBadge = (idx: number) =>
  idx === 0 ? 'bg-yellow-400 text-yellow-900'
  : idx === 1 ? 'bg-slate-300 text-slate-700'
  : idx === 2 ? 'bg-amber-600 text-white'
  : 'bg-slate-200 text-slate-500'

// Rohe Item-Logs (eine Zeile pro Spieler+Bild) zu einer Übersicht pro Spieler zusammenfassen
function aggregateItemLog(rows: ItemLogRow[]): Map<string, UserItemAgg> {
  const acc = new Map<string, { items: Map<string, number>; debuffs: Map<string, { count: number; senders: string[] }> }>()
  for (const row of rows) {
    let e = acc.get(row.user_id)
    if (!e) { e = { items: new Map(), debuffs: new Map() }; acc.set(row.user_id, e) }
    for (const k of row.items_used ?? []) e.items.set(k, (e.items.get(k) ?? 0) + 1)
    for (const d of row.debuffs_received ?? []) {
      const cur = e.debuffs.get(d.debuff_type) ?? { count: 0, senders: [] }
      cur.count += d.stacks || 1
      if (d.sender) cur.senders.push(d.sender)
      e.debuffs.set(d.debuff_type, cur)
    }
  }
  const out = new Map<string, UserItemAgg>()
  for (const [uid, e] of acc) {
    out.set(uid, {
      items: [...e.items].map(([key, count]) => ({ key, count })),
      debuffs: [...e.debuffs].map(([type, v]) => ({ type, count: v.count, senders: v.senders })),
    })
  }
  return out
}

// Kleines Item-Icon in der Ranglisten-Zeile. Grün = selbst eingesetzt, Rot = erhaltener Debuff.
// stopPropagation, damit das Antippen nicht die Profil-Navigation der Zeile auslöst.
function ItemChip({ itemKey, count, tone, onTap }: { itemKey: string; count: number; tone: 'good' | 'bad'; onTap: () => void }) {
  const it = getShopItem(itemKey)
  const Icon = it?.icon ?? Search
  const cls = tone === 'good' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
  return (
    <button
      onClick={e => { e.stopPropagation(); onTap() }}
      className={`inline-flex items-center gap-0.5 ${cls} rounded-full px-1.5 py-0.5 text-[11px] font-extrabold active:scale-95 transition-transform`}
    >
      <Icon size={12} strokeWidth={2.5} />
      {count > 1 && <span>×{count}</span>}
    </button>
  )
}

// Alle Tages-Slots des Events (Start bis Ende, jeweils zur täglichen Freigabezeit)
function buildSlots(event: LiveEvent): number[] {
  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate(), event.daily_release_hour, event.daily_release_minute, 0, 0)
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate(), event.daily_release_hour, event.daily_release_minute, 0, 0).getTime()
  const slots: number[] = []
  for (let i = 0; i < 366 && d.getTime() <= endMs; i++) {
    slots.push(d.getTime())
    d.setDate(d.getDate() + 1)
  }
  return slots
}

function sameDayMs(a: number, b: number) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
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
