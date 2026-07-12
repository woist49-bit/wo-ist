import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Layers, GraduationCap, Check, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { GameCard } from '../components/ui/GameCard'
import type { World } from '../types'

interface WorldStats { members: number; campaigns: number; activeEvent: string | null }

export function WorldsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [worlds, setWorlds] = useState<World[]>([])
  const [stats, setStats] = useState<Record<string, WorldStats>>({})
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (user) loadWorlds() }, [user])

  async function loadWorlds() {
    if (!user) return
    const { data } = await supabase
      .from('world_members')
      .select('world_id, role, worlds(*)')
      .eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[]
    const ws = rows.map(r => r.worlds).filter(Boolean) as World[]
    setWorlds(ws)
    const roleMap: Record<string, string> = {}
    for (const r of rows) if (r.world_id) roleMap[r.world_id] = r.role
    setRoles(roleMap)

    const ids = ws.map(w => w.id)
    if (!ids.length) { setStats({}); return }

    // Kennzahlen pro Welt: Mitglieder, Kampagnen, laufendes Live-Event
    const [membersRes, campaignsRes, eventsRes] = await Promise.all([
      supabase.from('world_members').select('world_id').in('world_id', ids),
      supabase.from('campaigns').select('world_id').in('world_id', ids),
      supabase.from('live_events').select('world_id, title').eq('status', 'active').in('world_id', ids),
    ])
    const next: Record<string, WorldStats> = {}
    for (const id of ids) next[id] = { members: 0, campaigns: 0, activeEvent: null }
    for (const m of membersRes.data ?? []) if (next[m.world_id]) next[m.world_id].members++
    for (const c of campaignsRes.data ?? []) if (next[c.world_id]) next[c.world_id].campaigns++
    for (const e of eventsRes.data ?? []) if (next[e.world_id]) next[e.world_id].activeEvent = e.title
    setStats(next)
  }

  async function createWorld(e: FormEvent) {
    e.preventDefault()
    if (!user || !newName.trim()) return
    setLoading(true); setError('')

    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { data: world, error: err } = await supabase
      .from('worlds')
      .insert({ name: newName.trim(), description: newDescription.trim() || null, join_code: code, created_by: user.id })
      .select().single()

    if (err || !world) { setError(err?.message ?? 'Fehler'); setLoading(false); return }
    await supabase.from('world_members').insert({ world_id: world.id, user_id: user.id, role: 'admin' })
    setLoading(false); setShowCreate(false); setNewName(''); setNewDescription('')
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

  return (
    <div className="p-4">
      <div className="max-w-lg mx-auto pt-3">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-white">Hallo, {profile?.username} 👋</h1>
          <p className="text-white/50 text-sm mt-0.5">Deine Spielwelten</p>
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
          <Button onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }} variant="info" className="flex-1">
            Beitreten
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
              {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" variant="success" loading={loading} className="flex-1">Erstellen</Button>
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Abbrechen</Button>
              </div>
            </form>
          </GameCard>
        )}

        {showJoin && (
          <GameCard className="mb-4">
            <form onSubmit={joinWorld} className="flex flex-col gap-3">
              <h2 className="font-extrabold text-slate-800">Spielwelt beitreten</h2>
              <Input
                tone="light"
                placeholder="Einladungscode (z. B. AB12CD)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                autoCapitalize="characters"
                autoFocus
              />
              {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" variant="success" loading={loading} className="flex-1">Beitreten</Button>
                <Button type="button" variant="secondary" onClick={() => setShowJoin(false)}>Abbrechen</Button>
              </div>
            </form>
          </GameCard>
        )}

        {worlds.length === 0 ? (
          <GameCard className="text-center py-12 text-slate-500">
            <p className="text-4xl mb-3">🌍</p>
            <p className="font-semibold">Noch keine Spielwelten.<br />Erstelle eine oder tritt bei!</p>
          </GameCard>
        ) : (
          <div className="flex flex-col gap-3">
            {worlds.map(w => {
              const s = stats[w.id]
              const isAdmin = roles[w.id] === 'admin'
              return (
                <button key={w.id} onClick={() => navigate(`/world/${w.id}`)} className="relative w-full text-left active:translate-y-[2px] transition-transform">
                  {isAdmin && (
                    <span className="absolute -top-2 right-4 z-10 inline-flex items-center gap-1 bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 text-[11px] font-extrabold shadow-[0_2px_0_#0000002e,inset_0_1px_0_#ffffff80]">
                      <Crown size={12} strokeWidth={2.75} /> Admin
                    </span>
                  )}
                  <GameCard style={isAdmin ? { borderColor: '#f59e0b' } : undefined}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-slate-800 truncate">{w.name}</p>
                          {s?.activeEvent && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-white bg-rose-500 rounded-full px-2 py-0.5 flex-shrink-0 shadow-[inset_0_1px_0_#ffffff59]">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                            </span>
                          )}
                        </div>
                        {w.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{w.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                          <span className="inline-flex items-center gap-1"><Users size={13} strokeWidth={2.5} /> {s?.members ?? '–'}</span>
                          <span className="inline-flex items-center gap-1"><Layers size={13} strokeWidth={2.5} /> {s?.campaigns ?? 0} {(s?.campaigns ?? 0) === 1 ? 'Kampagne' : 'Kampagnen'}</span>
                          {s?.activeEvent && <span className="text-rose-500 truncate">· {s.activeEvent}</span>}
                        </div>
                      </div>
                      <span className="text-slate-400 text-xl flex-shrink-0">›</span>
                    </div>
                  </GameCard>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
