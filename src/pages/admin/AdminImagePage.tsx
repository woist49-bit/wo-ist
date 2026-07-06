import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Trophy, Target, ChevronDown, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { GameCard } from '../../components/ui/GameCard'
import { IconButton } from '../../components/ui/IconButton'
import { DescriptionInput } from '../../components/ui/DescriptionInput'
import { BoundingBoxEditor } from '../../components/marker/BoundingBoxEditor'
import { FramedAvatar } from '../../components/ui/FramedAvatar'
import { useToast } from '../../stores/toast'
import type { EventImage } from '../../types'

// Normalisiertes Spielerergebnis (Event: player_attempts, Kampagne: campaign_progress)
interface PlayerResult {
  user_id: string
  username: string | null
  avatar_url: string | null
  equipped_frame: string | null
  correct: boolean
  points: number
  time_seconds: number | null // nur Live-Event
  when: string | null
}

// Admin-Ansicht eines Bildes: Marker bearbeiten + wer hat gespielt.
// Funktioniert für Live-Event-Bilder (:eventId) und Legacy-Kampagnen-Bilder (:campaignId).
export function AdminImagePage() {
  const { worldId, eventId, campaignId, imageId } = useParams<{ worldId: string; eventId: string; campaignId: string; imageId: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const isCampaign = !!campaignId
  const [image, setImage] = useState<EventImage | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<PlayerResult[]>([])
  const [editDesc, setEditDesc] = useState('')
  const [markerOpen, setMarkerOpen] = useState(false) // eingeklappt, damit man nicht versehentlich bearbeitet
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (imageId && user) load() }, [imageId, user])

  async function load() {
    // Nur Admins der Welt – sonst zurück in den Spielscreen
    const { data: role } = await supabase.from('world_members').select('role').eq('world_id', worldId).eq('user_id', user!.id).maybeSingle()
    if (role?.role !== 'admin') {
      const base = isCampaign ? `campaign/${campaignId}` : `event/${eventId}`
      navigate(`/world/${worldId}/${base}/image/${imageId}`, { replace: true })
      return
    }

    const imgRes = await supabase.from('event_images').select('*').eq('id', imageId).single()
    setImage(imgRes.data)
    setEditDesc(imgRes.data?.description ?? '')

    // Reihenfolge (für "Bild N")
    const orderQuery = isCampaign
      ? supabase.from('event_images').select('id').eq('campaign_id', campaignId).order('sort_order', { ascending: true })
      : supabase.from('event_images').select('id').eq('event_id', eventId).order('unlocks_at', { ascending: true }).order('sort_order', { ascending: true })
    const { data: order } = await orderQuery
    const idx = (order ?? []).findIndex(r => r.id === imageId)
    setIndex(idx >= 0 ? idx : 0)

    // Ergebnisse laden
    if (isCampaign) {
      const { data } = await supabase.rpc('campaign_image_players', { p_campaign_id: campaignId, p_image_id: imageId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResults(((data ?? []) as any[]).map(r => ({
        user_id: r.user_id, username: r.username, avatar_url: r.avatar_url, equipped_frame: r.equipped_frame,
        correct: r.found, points: r.points, time_seconds: null, when: null,
      })))
    } else {
      const { data } = await supabase.from('player_attempts')
        .select('user_id, is_correct, points, time_seconds, attempted_at, profile:profiles(username, avatar_url, equipped_frame)')
        .eq('image_id', imageId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: PlayerResult[] = ((data ?? []) as any[]).map(r => ({
        user_id: r.user_id, username: r.profile?.username ?? null, avatar_url: r.profile?.avatar_url ?? null, equipped_frame: r.profile?.equipped_frame ?? null,
        correct: r.is_correct, points: r.points, time_seconds: r.time_seconds as number, when: r.attempted_at as string,
      }))
      rows.sort((a, b) => (b.correct ? 1 : 0) - (a.correct ? 1 : 0) || b.points - a.points || (a.time_seconds ?? 0) - (b.time_seconds ?? 0))
      setResults(rows)
    }
    setLoading(false)
  }

  async function saveMarker(tx: number, ty: number, tr: number) {
    if (!image) return
    const d = editDesc.trim() || null
    const { error } = await supabase.from('event_images')
      .update({ target_x: tx, target_y: ty, target_radius: tr, description: d }).eq('id', image.id)
    if (error) { addToast('Speichern fehlgeschlagen: ' + error.message, 'error', 6000); return }
    setImage(prev => prev ? { ...prev, target_x: tx, target_y: ty, target_radius: tr, description: d } : prev)
    addToast('Bild gespeichert.', 'success')
  }

  if (loading) return <LoadingScreen />
  if (!image) return <div className="p-8 text-center text-white/50">Bild nicht gefunden.</div>

  const finds = results.filter(r => r.correct).length

  return (
    <div className="p-4 max-w-2xl mx-auto pt-2">
      <div className="flex items-center gap-3 mb-4 safe-top">
        <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-white">Bild {index + 1} · Admin-Ansicht</h1>
          {!isCampaign && (
            <p className="text-white/50 text-xs">Freigeschaltet: {new Date(image.unlocks_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
          )}
        </div>
      </div>

      <GameCard className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Wer hat gespielt</h2>
          <span className="text-xs font-bold text-slate-500">{results.length} gespielt · {finds} gefunden</span>
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Noch niemand hat dieses Bild gespielt.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map(r => (
              <div key={r.user_id} className="flex items-center gap-3 bg-white/60 rounded-2xl px-3 py-2">
                <FramedAvatar url={r.avatar_url} name={r.username} frame={r.equipped_frame} size={36} className="text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-slate-800 truncate">{r.username ?? '—'}</p>
                  <p className="text-xs text-slate-500">
                    {r.time_seconds != null ? `${r.time_seconds}s` : 'Kampagne'}
                    {r.when ? ` · ${new Date(r.when).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}` : ''}
                  </p>
                </div>
                {r.correct ? (
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-green-600 flex-shrink-0"><Check size={16} strokeWidth={3} /> {r.points} Pkt</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-red-500 flex-shrink-0"><X size={16} strokeWidth={3} /> Daneben</span>
                )}
              </div>
            ))}
          </div>
        )}
      </GameCard>

      <GameCard>
        <button onClick={() => setMarkerOpen(o => !o)} className="w-full flex items-center justify-between active:scale-[0.99] transition-transform">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2"><Target size={18} className="text-violet-500" /> Marker bearbeiten</h2>
          <ChevronDown size={20} strokeWidth={2.5} className={`text-slate-400 transition-transform ${markerOpen ? 'rotate-180' : ''}`} />
        </button>
        {markerOpen && (
          <div className="mt-4">
            <DescriptionInput value={editDesc} onChange={setEditDesc} />
            <div className="mt-3">
              <BoundingBoxEditor image={image} onSave={saveMarker} />
            </div>
          </div>
        )}
      </GameCard>
    </div>
  )
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
