import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import type { World, LiveEvent, Campaign, WorldMember } from '../types'

interface Progress { total: number; done: number }

export function WorldHomePage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [world, setWorld] = useState<World | null>(null)
  const [membership, setMembership] = useState<WorldMember | null>(null)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [showCode, setShowCode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (worldId && user) load() }, [worldId, user])

  async function load() {
    const [worldRes, memberRes, eventsRes, campaignRes, imagesRes] = await Promise.all([
      supabase.from('worlds').select('*').eq('id', worldId).single(),
      supabase.from('world_members').select('*').eq('world_id', worldId).eq('user_id', user!.id).single(),
      supabase.from('live_events').select('*').eq('world_id', worldId).order('starts_at', { ascending: false }),
      supabase.from('campaigns').select('*').eq('world_id', worldId).order('created_at', { ascending: false }),
      supabase.from('event_images').select('*').eq('world_id', worldId),
    ])
    setWorld(worldRes.data)
    setMembership(memberRes.data)
    setLiveEvents(eventsRes.data ?? [])
    const camps = (campaignRes.data ?? []) as Campaign[]
    setCampaigns(camps)

    // Fortschritt pro Kampagne (Dot-Indicator: erfolgreich gefundene Bilder)
    const images = (imagesRes.data ?? []) as { id: string; event_id: string | null; campaign_id: string | null }[]
    const ids = images.map(i => i.id)
    let correct = new Set<string>()
    if (ids.length) {
      const { data: atts } = await supabase.from('player_attempts').select('image_id, is_correct').eq('user_id', user!.id).in('image_id', ids)
      correct = new Set((atts ?? []).filter(a => a.is_correct).map(a => a.image_id))
    }
    const prog: Record<string, Progress> = {}
    for (const c of camps) {
      const imgs = images.filter(i => c.original_event_id ? i.event_id === c.original_event_id : i.campaign_id === c.id)
      prog[c.id] = { total: imgs.length, done: imgs.filter(i => correct.has(i.id)).length }
    }
    setProgress(prog)
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
    <div className="p-4 max-w-lg mx-auto pt-5 pb-8">
      {/* Bereich 1: Name + Beschreibung als reiner Text */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-white">{world.name}</h1>
          {world.description && <p className="text-white/60 text-sm mt-1">{world.description}</p>}
          <button onClick={() => setShowCode(!showCode)} className="text-violet-300 text-xs mt-2 font-semibold">
            {showCode ? `Code: ${world.join_code}` : 'Einladungscode anzeigen'}
          </button>
        </div>
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/world/${worldId}/admin`)}>Admin</Button>
        )}
      </div>

      {/* Bereich 2: Live-Event-Banner */}
      {activeEvent ? (
        <button onClick={() => navigate(`/world/${worldId}/event/${activeEvent.id}`)} className="w-full text-left mb-7 active:translate-y-[2px] transition-transform">
          <GameCard className="!bg-violet-500 !border-violet-700 !text-white !shadow-[0_5px_0_#5b21b6]">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-100 mb-1">🔴 Live jetzt</p>
            <p className="text-xl font-extrabold">{activeEvent.title}</p>
            {activeEvent.description && <p className="text-violet-100/90 text-sm mt-1 line-clamp-2">{activeEvent.description}</p>}
            <p className="text-white text-sm font-bold mt-3">Jetzt spielen →</p>
          </GameCard>
        </button>
      ) : (
        <GameCard className="!bg-[#efe2c4] !border-[#dcc99c] text-center text-slate-500 font-semibold mb-7 py-6">
          Kein aktives Live-Event
        </GameCard>
      )}

      {/* Kampagnen-Liste */}
      <h2 className="text-lg font-extrabold text-white mb-3">Kampagnen</h2>
      {campaigns.length === 0 ? (
        <GameCard className="text-center text-slate-500 py-6">Noch keine Kampagnen</GameCard>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map(c => {
            const p = progress[c.id] ?? { total: 0, done: 0 }
            return (
              <button key={c.id} onClick={() => navigate(`/world/${worldId}/campaign/${c.id}`)} className="w-full text-left active:translate-y-[2px] transition-transform">
                <GameCard>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 truncate">{c.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.is_legacy ? 'Legacy' : 'Kampagne'} · {p.done}/{p.total} geschafft
                      </p>
                    </div>
                    <DotProgress total={p.total} done={p.done} />
                  </div>
                </GameCard>
              </button>
            )
          })}
        </div>
      )}

      <button onClick={leaveWorld} className="block mx-auto mt-8 text-white/30 hover:text-white/50 text-sm transition-colors">
        Spielwelt verlassen
      </button>
    </div>
  )
}

function DotProgress({ total, done }: { total: number; done: number }) {
  if (total === 0) return <span className="text-xs text-slate-400 flex-shrink-0">–</span>
  if (total > 12) return <span className="text-sm font-extrabold text-slate-600 flex-shrink-0">{done}/{total}</span>
  return (
    <div className="flex gap-1.5 flex-shrink-0">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`w-3 h-3 rounded-full ${i < done ? 'bg-green-500 shadow-[inset_0_1px_0_#ffffff80]' : 'bg-slate-300'}`} />
      ))}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
