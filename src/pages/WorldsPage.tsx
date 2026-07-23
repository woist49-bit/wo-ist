import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Layers, GraduationCap, Check, Crown, ThumbsUp, Globe, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { GameCard } from '../components/ui/GameCard'
import { Toggle } from '../components/ui/Toggle'
import type { World, PublicWorld } from '../types'

interface WorldStats { members: number; campaigns: number; activeEvent: string | null }
interface LikeState { count: number; mine: boolean }

export function WorldsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [worlds, setWorlds] = useState<World[]>([])
  const [stats, setStats] = useState<Record<string, WorldStats>>({})
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [likes, setLikes] = useState<Record<string, LikeState>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPublic, setNewPublic] = useState(false)   // Standard: privat wie bisher
  const [joinCode, setJoinCode] = useState('')
  const [publicWorlds, setPublicWorlds] = useState<PublicWorld[]>([])
  const [joinTarget, setJoinTarget] = useState<PublicWorld | null>(null)  // Bestätigungsdialog
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Drag & Drop zum Umsortieren. Kleine Aktivierungs-Distanz, damit Tippen (Welt öffnen) und
  // Scrollen weiter funktionieren – gezogen wird nur über den Griff.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const orderKey = user ? `wo-ist:world-order:${user.id}` : null

  // Selbst gewählte Reihenfolge NUR auf diesem Gerät (localStorage). Unbekannte/neue Welten ans Ende.
  function applySavedOrder(ws: World[]): World[] {
    if (!orderKey) return ws
    try {
      const saved = JSON.parse(localStorage.getItem(orderKey) || '[]') as string[]
      if (!saved.length) return ws
      const rank = new Map(saved.map((id, i) => [id, i]))
      return [...ws].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
    } catch { return ws }
  }
  function saveOrder(ws: World[]) {
    if (!orderKey) return
    try { localStorage.setItem(orderKey, JSON.stringify(ws.map(w => w.id))) } catch { /* ignore */ }
  }
  function onWorldDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setWorlds(prev => {
      const next = arrayMove(prev, prev.findIndex(w => w.id === active.id), prev.findIndex(w => w.id === over.id))
      saveOrder(next)
      return next
    })
  }

  useEffect(() => { if (user) loadWorlds() }, [user])
  // Öffentliche Liste erst laden, wenn der Bereich geöffnet wird – nicht bei jedem Seitenaufruf.
  useEffect(() => { if (showJoin) loadPublic() }, [showJoin])

  async function loadWorlds() {
    if (!user) return
    const { data } = await supabase
      .from('world_members')
      .select('world_id, role, worlds(*)')
      .eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[]
    const ws = rows.map(r => r.worlds).filter(Boolean) as World[]
    setWorlds(applySavedOrder(ws))
    const roleMap: Record<string, string> = {}
    for (const r of rows) if (r.world_id) roleMap[r.world_id] = r.role
    setRoles(roleMap)

    const ids = ws.map(w => w.id)
    if (!ids.length) { setStats({}); setLikes({}); return }

    // Kennzahlen pro Welt: Mitglieder, Kampagnen, laufendes Live-Event, Bewertungen
    const [membersRes, campaignsRes, eventsRes, likesRes] = await Promise.all([
      supabase.from('world_members').select('world_id').in('world_id', ids),
      supabase.from('campaigns').select('world_id').in('world_id', ids),
      supabase.from('live_events').select('world_id, title').eq('status', 'active').in('world_id', ids),
      supabase.from('world_likes').select('world_id, user_id').in('world_id', ids),
    ])
    const next: Record<string, WorldStats> = {}
    for (const id of ids) next[id] = { members: 0, campaigns: 0, activeEvent: null }
    for (const m of membersRes.data ?? []) if (next[m.world_id]) next[m.world_id].members++
    for (const c of campaignsRes.data ?? []) if (next[c.world_id]) next[c.world_id].campaigns++
    for (const e of eventsRes.data ?? []) if (next[e.world_id]) next[e.world_id].activeEvent = e.title
    setStats(next)

    const lm: Record<string, LikeState> = {}
    for (const id of ids) lm[id] = { count: 0, mine: false }
    for (const l of likesRes.data ?? []) {
      if (!lm[l.world_id]) continue
      lm[l.world_id].count++
      if (l.user_id === user.id) lm[l.world_id].mine = true
    }
    setLikes(lm)
  }

  async function loadPublic() {
    const { data } = await supabase.rpc('public_worlds')
    setPublicWorlds((data ?? []) as PublicWorld[])
  }

  // Daumen-hoch umschalten. Optimistisch, damit es sich sofort anfühlt; bei einem Fehler
  // wird der alte Stand zurückgerollt. Berührt weder Punkte noch Gems oder XP.
  async function toggleLike(worldId: string) {
    if (!user) return
    const before = likes[worldId] ?? { count: 0, mine: false }
    setLikes(p => ({ ...p, [worldId]: { count: before.count + (before.mine ? -1 : 1), mine: !before.mine } }))
    const { error: err } = before.mine
      ? await supabase.from('world_likes').delete().eq('world_id', worldId).eq('user_id', user.id)
      : await supabase.from('world_likes').insert({ world_id: worldId, user_id: user.id })
    if (err) setLikes(p => ({ ...p, [worldId]: before }))
  }

  async function createWorld(e: FormEvent) {
    e.preventDefault()
    if (!user || !newName.trim()) return
    setLoading(true); setError('')

    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { data: world, error: err } = await supabase
      .from('worlds')
      .insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
        is_public: newPublic,
        join_code: code,
        created_by: user.id,
      })
      .select().single()

    if (err || !world) { setError(err?.message ?? 'Fehler'); setLoading(false); return }
    await supabase.from('world_members').insert({ world_id: world.id, user_id: user.id, role: 'admin' })
    setLoading(false); setShowCreate(false); setNewName(''); setNewDescription(''); setNewPublic(false)
    navigate(`/world/${world.id}`)
  }

  async function joinWorld(e: FormEvent) {
    e.preventDefault()
    if (!user || !joinCode.trim()) return
    setLoading(true); setError('')

    const { data: worldId, error: err } = await supabase.rpc('join_world', { p_user_id: user.id, p_join_code: joinCode.trim() })

    if (err) {
      if (err.message.includes('INVALID_CODE')) {
        setError('Ungültiger Code.')
      } else if (err.message.includes('ALREADY_MEMBER')) {
        setError('Du bist bereits Mitglied.')
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }

    if (!worldId) { setError('Ungültiger Code.'); setLoading(false); return }

    setLoading(false); setShowJoin(false); setJoinCode('')
    navigate(`/world/${worldId}`)
  }

  // Beitritt aus der öffentlichen Liste – erst nach Bestätigung im Dialog.
  async function confirmJoinPublic() {
    if (!joinTarget) return
    setJoining(true); setJoinError('')
    const { error: err } = await supabase.rpc('join_public_world', { p_world_id: joinTarget.id })
    setJoining(false)
    if (err) {
      setJoinError(err.message.includes('ALREADY_MEMBER') ? 'Du bist bereits Mitglied.' : 'Beitreten fehlgeschlagen.')
      return
    }
    setJoinTarget(null)
    setShowJoin(false)   // direkt zurück zur Startansicht „Deine Spielwelten" – kein extra Zurück-Tippen
    // Welt wandert aus der öffentlichen Liste zu „Deine Spielwelten"
    await Promise.all([loadWorlds(), loadPublic()])
  }

  return (
    <div className="p-4">
      <div className="max-w-lg mx-auto pt-3">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-white">Hallo, {profile?.username} 👋</h1>
          <p className="text-white/50 text-sm mt-0.5">{showJoin ? 'Tritt einer Spielwelt bei' : 'Deine Spielwelten'}</p>
        </div>

        <button
          onClick={() => navigate('/tutorial')}
          className="w-full mb-4 flex items-center gap-3 bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-2xl px-4 py-3 text-left active:translate-y-[2px] transition-transform shadow-[0_4px_0_#00000014]"
        >
          <div className="w-11 h-11 rounded-xl bg-violet-500 text-white flex items-center justify-center shadow-[0_2px_0_#5b21b6,inset_0_2px_0_#ffffff4d] flex-shrink-0">
            <GraduationCap size={22} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
              Tutorial
              {profile?.tutorial_completed && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white" aria-label="Abgeschlossen">
                  <Check size={11} strokeWidth={4} />
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">So funktioniert „Wo ist…?" – jederzeit wiederholbar</p>
          </div>
          <span className="text-slate-400 text-xl flex-shrink-0">›</span>
        </button>

        <div className="flex gap-3 mb-6">
          <Button onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }} variant="primary" className="flex-1">
            + Erstellen
          </Button>
          {/* Beitreten öffnet eine Unterseite -> derselbe Button führt auch wieder zurück.
              Farbe wechselt mit: blau = Beitreten, grau = Zurück (klare Unterscheidung). */}
          <Button onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setError('') }} variant={showJoin ? 'secondary' : 'info'} className="flex-1">
            {showJoin ? 'Zurück' : 'Beitreten'}
          </Button>
        </div>

        {showCreate && (
          <GameCard className="mb-4">
            <form onSubmit={createWorld} className="flex flex-col gap-3">
              <h2 className="font-extrabold text-slate-800">Neue Spielwelt</h2>
              <Input tone="light" placeholder="Name der Spielwelt" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <textarea
                placeholder="Beschreibung (optional)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                rows={2}
                className="w-full border-2 border-[#e6d3a3] rounded-xl px-4 py-3 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition resize-none"
              />
              <Toggle
                checked={newPublic}
                onChange={setNewPublic}
                label="Öffentlich"
                hint="Für alle im „Beitreten“-Bereich sichtbar – Beitritt ohne Einladungscode"
              />
              {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" variant="success" loading={loading} className="flex-1">Erstellen</Button>
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Abbrechen</Button>
              </div>
            </form>
          </GameCard>
        )}

        {showJoin && (
          <>
            <GameCard className="mb-4">
              <form onSubmit={joinWorld} className="flex flex-col gap-3">
                <h2 className="font-extrabold text-slate-800">Spielwelt beitreten</h2>
                {/* Kein autoFocus: Tastatur soll erst aufgehen, wenn man das Feld antippt. */}
                <Input
                  tone="light"
                  placeholder="Einladungscode (z. B. AB12CD)"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  autoCapitalize="characters"
                />
                {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
                <Button type="submit" variant="success" loading={loading} className="w-full">Beitreten</Button>
              </form>
            </GameCard>

            <h2 className="text-lg font-extrabold text-white mb-3 flex items-center gap-2">
              <Globe size={18} strokeWidth={2.75} /> Öffentliche Spielwelten
            </h2>
            {publicWorlds.length === 0 ? (
              <GameCard className="text-center py-8 text-slate-400 text-sm font-semibold mb-4">
                Zurzeit gibt es keine öffentlichen Spielwelten, denen du noch nicht angehörst.
              </GameCard>
            ) : (
              <div className="flex flex-col gap-3 mb-6">
                {publicWorlds.map(w => (
                  <div
                    key={w.id}
                    onClick={() => { setJoinTarget(w); setJoinError('') }}
                    className="relative w-full text-left active:translate-y-[2px] transition-transform cursor-pointer"
                  >
                    {/* Badge sitzt oben im Streifen wie bei „Deine Spielwelten“ – beide Listen
                        benutzen dieselbe Kachel und sollen sich gleich verhalten. Ein
                        „Öffentlich“-Badge fehlt hier bewusst: hier ist ohnehin alles öffentlich. */}
                    {w.active_event && (
                      <div className="absolute -top-2 right-4 z-10 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-rose-500 text-white rounded-full px-2 py-0.5 text-[11px] font-extrabold shadow-[0_2px_0_#0000002e,inset_0_1px_0_#ffffff59]">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live-Event
                        </span>
                      </div>
                    )}
                    <GameCard>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-slate-800 truncate">{w.name}</p>
                          {w.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{w.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1"><Users size={13} strokeWidth={2.5} /> {w.members}</span>
                            <span className="inline-flex items-center gap-1"><Layers size={13} strokeWidth={2.5} /> {w.campaigns} {w.campaigns === 1 ? 'Kampagne' : 'Kampagnen'}</span>
                            {w.active_event && <span className="text-rose-500 truncate">· {w.active_event}</span>}
                          </div>
                        </div>
                        <span className="text-slate-400 text-xl flex-shrink-0">›</span>
                      </div>
                    </GameCard>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* In der Beitreten-Unterseite ausgeblendet: die eigenen Welten direkt unter der
            öffentlichen Liste sahen aus, als wären sie auch öffentlich. */}
        {showJoin ? null : worlds.length === 0 ? (
          <GameCard className="text-center py-12 text-slate-500">
            <p className="text-4xl mb-3">🌍</p>
            <p className="font-semibold">Noch keine Spielwelten.<br />Erstelle eine oder tritt bei!</p>
          </GameCard>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWorldDragEnd}>
            <SortableContext items={worlds.map(w => w.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {worlds.map(w => (
                  <SortableWorldCard
                    key={w.id}
                    w={w}
                    s={stats[w.id]}
                    isAdmin={roles[w.id] === 'admin'}
                    like={likes[w.id] ?? { count: 0, mine: false }}
                    onOpen={() => navigate(`/world/${w.id}`)}
                    onToggleLike={() => toggleLike(w.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {joinTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <GameCard className="w-full max-w-sm">
            <p className="font-extrabold text-slate-800 text-lg mb-1">Spielwelt beitreten?</p>
            <p className="text-slate-600 text-sm mb-4">
              Möchtest du der Spielwelt „{joinTarget.name}" beitreten?
            </p>
            {joinError && <p className="text-red-600 text-sm font-medium mb-3">{joinError}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setJoinTarget(null)}>Abbrechen</Button>
              <Button variant="success" className="flex-1" loading={joining} onClick={confirmJoinPublic}>Beitreten</Button>
            </div>
          </GameCard>
        </div>
      )}
    </div>
  )
}

// Eine Welt-Kachel, per Griff (links) umsortierbar. Antippen der Kachel öffnet die Welt,
// der Daumen-hoch-Button und der Griff stoppen die Weiterleitung (stopPropagation).
function SortableWorldCard({ w, s, isAdmin, like, onOpen, onToggleLike }: {
  w: World
  s: WorldStats | undefined
  isAdmin: boolean
  like: LikeState
  onOpen: () => void
  onToggleLike: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.9 : 1 }}
      onClick={onOpen}
      className="relative w-full text-left active:translate-y-[2px] transition-transform cursor-pointer"
    >
      {(isAdmin || w.is_public || s?.activeEvent) && (
        <div className="absolute -top-2 right-4 z-10 flex items-center gap-1.5">
          {s?.activeEvent && (
            <span className="inline-flex items-center gap-1 bg-rose-500 text-white rounded-full px-2 py-0.5 text-[11px] font-extrabold shadow-[0_2px_0_#0000002e,inset_0_1px_0_#ffffff59]">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live-Event
            </span>
          )}
          {w.is_public && (
            <span className="inline-flex items-center gap-1 bg-sky-500 text-white rounded-full px-2 py-0.5 text-[11px] font-extrabold shadow-[0_2px_0_#0000002e,inset_0_1px_0_#ffffff59]">
              <Globe size={12} strokeWidth={2.75} /> Öffentlich
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 text-[11px] font-extrabold shadow-[0_2px_0_#0000002e,inset_0_1px_0_#ffffff80]">
              <Crown size={12} strokeWidth={2.75} /> Admin
            </span>
          )}
        </div>
      )}
      <GameCard>
        <div className="flex items-center gap-2">
          {/* Griff: touch-none, damit das Ziehen nicht mit dem Scrollen kollidiert. */}
          <button
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            aria-label="Zum Umsortieren ziehen"
            className="flex-shrink-0 -ml-1 p-1 text-slate-300 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={20} strokeWidth={2.5} />
          </button>
          <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-slate-800 truncate">{w.name}</p>
              {w.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{w.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1"><Users size={13} strokeWidth={2.5} /> {s?.members ?? '–'}</span>
                <span className="inline-flex items-center gap-1"><Layers size={13} strokeWidth={2.5} /> {s?.campaigns ?? 0} {(s?.campaigns ?? 0) === 1 ? 'Kampagne' : 'Kampagnen'}</span>
                {s?.activeEvent && <span className="text-rose-500 truncate">· {s.activeEvent}</span>}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onToggleLike() }}
              aria-pressed={like.mine}
              aria-label={like.mine ? 'Daumen-hoch zurücknehmen' : 'Daumen-hoch geben'}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 flex-shrink-0 transition-colors active:scale-95 ${
                like.mine ? 'bg-violet-100 text-violet-600' : 'text-slate-400'
              }`}
            >
              <ThumbsUp size={17} strokeWidth={2.5} fill={like.mine ? 'currentColor' : 'none'} />
              <span className="text-[11px] font-extrabold">{like.count}</span>
            </button>
            <span className="text-slate-400 text-xl flex-shrink-0">›</span>
          </div>
        </div>
      </GameCard>
    </div>
  )
}
