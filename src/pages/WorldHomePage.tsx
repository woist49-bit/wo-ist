import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { World, LiveEvent, Campaign, WorldMember } from '../types'

export function WorldHomePage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [world, setWorld] = useState<World | null>(null)
  const [membership, setMembership] = useState<WorldMember | null>(null)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCode, setShowCode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (worldId && user) load() }, [worldId, user])

  async function load() {
    const [worldRes, memberRes, eventsRes, campaignRes] = await Promise.all([
      supabase.from('worlds').select('*').eq('id', worldId).single(),
      supabase.from('world_members').select('*').eq('world_id', worldId).eq('user_id', user!.id).single(),
      supabase.from('live_events').select('*').eq('world_id', worldId).order('starts_at', { ascending: false }),
      supabase.from('campaigns').select('*').eq('world_id', worldId).order('created_at', { ascending: false }),
    ])
    setWorld(worldRes.data)
    setMembership(memberRes.data)
    setLiveEvents(eventsRes.data ?? [])
    setCampaigns(campaignRes.data ?? [])
    setLoading(false)
  }

  async function leaveWorld() {
    if (!confirm('Spielwelt wirklich verlassen?')) return
    await supabase.from('world_members').delete().eq('world_id', worldId).eq('user_id', user!.id)
    navigate('/worlds')
  }

  if (loading) return <LoadingScreen />
  if (!world) return <div className="p-8 text-center text-white/50">Spielwelt nicht gefunden.</div>

  const isAdmin = membership?.role === 'admin'
  const activeEvent = liveEvents.find(e => e.status === 'active')

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate('/worlds')} className="text-white/40 text-sm mb-1 hover:text-white/70 transition-colors">← Alle Welten</button>
          <h1 className="text-2xl font-bold text-white">{world.name}</h1>
          <button onClick={() => setShowCode(!showCode)} className="text-indigo-400 text-sm mt-1">
            {showCode ? `Code: ${world.join_code}` : 'Einladungscode anzeigen'}
          </button>
        </div>
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/world/${worldId}/admin`)}>
            Admin
          </Button>
        )}
      </div>

      {activeEvent && (
        <Card className="mb-4 bg-indigo-900/40 border-indigo-500/50">
          <p className="text-xs text-indigo-300 font-medium uppercase tracking-wider mb-1">🔴 Live jetzt</p>
          <p className="font-bold text-white text-lg">{activeEvent.title}</p>
          <Button size="sm" className="mt-3 w-full" onClick={() => navigate(`/world/${worldId}/event/${activeEvent.id}`)}>
            Zum Live-Event
          </Button>
        </Card>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Live-Events</h2>
        {liveEvents.length === 0 ? (
          <Card className="text-center py-6 text-white/30 text-sm">Noch keine Events</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {liveEvents.map(ev => (
              <button key={ev.id} onClick={() => navigate(`/world/${worldId}/event/${ev.id}`)} className="w-full text-left">
                <Card className="hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{ev.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{formatDate(ev.starts_at)} – {formatDate(ev.ends_at)}</p>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Kampagnen</h2>
        {campaigns.length === 0 ? (
          <Card className="text-center py-6 text-white/30 text-sm">Noch keine Kampagnen</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.map(c => (
              <button key={c.id} onClick={() => navigate(`/world/${worldId}/campaign/${c.id}`)} className="w-full text-left">
                <Card className="hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{c.title}</p>
                      {c.is_legacy && <span className="text-xs text-amber-400">Legacy</span>}
                    </div>
                    <span className="text-white/30">›</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      <Button variant="ghost" size="sm" onClick={leaveWorld} className="w-full text-white/30 mt-4">
        Spielwelt verlassen
      </Button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-700 text-slate-300',
    active: 'bg-green-900 text-green-300',
    finished: 'bg-slate-800 text-white/40',
  }
  const labels: Record<string, string> = { draft: 'Entwurf', active: 'Aktiv', finished: 'Beendet' }
  return <span className={`text-xs px-2 py-1 rounded-full ${map[status] ?? ''}`}>{labels[status] ?? status}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
