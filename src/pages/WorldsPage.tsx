import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { GameCard } from '../components/ui/GameCard'
import type { World } from '../types'

export function WorldsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [worlds, setWorlds] = useState<World[]>([])
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
      .select('world_id, worlds(*)')
      .eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data) setWorlds(data.map((r: any) => r.worlds).filter(Boolean))
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
            {worlds.map(w => (
              <button key={w.id} onClick={() => navigate(`/world/${w.id}`)} className="w-full text-left active:translate-y-[2px] transition-transform">
                <GameCard>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 truncate">{w.name}</p>
                      <p className="text-slate-500 text-sm mt-0.5">Code: {w.join_code}</p>
                    </div>
                    <span className="text-slate-400 text-xl flex-shrink-0">›</span>
                  </div>
                </GameCard>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
