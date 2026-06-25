import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../stores/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import type { World } from '../types'

export function WorldsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [worlds, setWorlds] = useState<World[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
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
      .insert({ name: newName.trim(), join_code: code, created_by: user.id })
      .select().single()

    if (err || !world) { setError(err?.message ?? 'Fehler'); setLoading(false); return }
    await supabase.from('world_members').insert({ world_id: world.id, user_id: user.id, role: 'admin' })
    setLoading(false); setShowCreate(false); setNewName('')
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
      <div className="max-w-lg mx-auto pt-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Hallo, {profile?.username} 👋</h1>
            <p className="text-white/50 text-sm mt-0.5">Deine Spielwelten</p>
          </div>
          <button onClick={() => signOut()} className="text-white/40 hover:text-white/70 text-sm transition-colors">
            Abmelden
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          <Button onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }} variant="primary" className="flex-1">
            + Erstellen
          </Button>
          <Button onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }} variant="secondary" className="flex-1">
            Beitreten
          </Button>
        </div>

        {showCreate && (
          <Card className="mb-4">
            <form onSubmit={createWorld} className="flex flex-col gap-3">
              <h2 className="font-semibold text-white">Neue Spielwelt</h2>
              <Input placeholder="Name der Spielwelt" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={loading} className="flex-1">Erstellen</Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
              </div>
            </form>
          </Card>
        )}

        {showJoin && (
          <Card className="mb-4">
            <form onSubmit={joinWorld} className="flex flex-col gap-3">
              <h2 className="font-semibold text-white">Spielwelt beitreten</h2>
              <Input
                placeholder="Einladungscode (z. B. AB12CD)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                autoCapitalize="characters"
                autoFocus
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={loading} className="flex-1">Beitreten</Button>
                <Button type="button" variant="ghost" onClick={() => setShowJoin(false)}>Abbrechen</Button>
              </div>
            </form>
          </Card>
        )}

        {worlds.length === 0 ? (
          <Card className="text-center py-12 text-white/40">
            <p className="text-4xl mb-3">🌍</p>
            <p>Noch keine Spielwelten.<br />Erstelle eine oder tritt bei!</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {worlds.map(w => (
              <button key={w.id} onClick={() => navigate(`/world/${w.id}`)} className="w-full text-left">
                <Card className="hover:bg-white/10 active:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{w.name}</p>
                      <p className="text-white/40 text-sm mt-0.5">Code: {w.join_code}</p>
                    </div>
                    <span className="text-white/30">›</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
