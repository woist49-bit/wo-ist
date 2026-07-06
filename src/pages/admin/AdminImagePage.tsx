import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { GameCard } from '../../components/ui/GameCard'
import { IconButton } from '../../components/ui/IconButton'
import { DescriptionInput } from '../../components/ui/DescriptionInput'
import { BoundingBoxEditor } from '../../components/marker/BoundingBoxEditor'
import { FramedAvatar } from '../../components/ui/FramedAvatar'
import { useToast } from '../../stores/toast'
import type { EventImage } from '../../types'

interface AttemptRow {
  user_id: string
  is_correct: boolean
  points: number
  time_seconds: number
  attempted_at: string
  profile: { username: string; avatar_url: string | null; equipped_frame: string | null } | null
}

// Admin-Ansicht eines einzelnen Bildes: Marker bearbeiten + Statistik (wer hat gespielt).
export function AdminImagePage() {
  const { worldId, eventId, imageId } = useParams<{ worldId: string; eventId: string; imageId: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [image, setImage] = useState<EventImage | null>(null)
  const [index, setIndex] = useState(0)
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [editDesc, setEditDesc] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (imageId && user) load() }, [imageId, user])

  async function load() {
    // Nur Admins der Welt dürfen hierher – sonst zurück in den Spielscreen
    const { data: role } = await supabase.from('world_members').select('role').eq('world_id', worldId).eq('user_id', user!.id).maybeSingle()
    if (role?.role !== 'admin') {
      navigate(`/world/${worldId}/event/${eventId}/image/${imageId}`, { replace: true })
      return
    }
    const [imgRes, orderRes, attRes] = await Promise.all([
      supabase.from('event_images').select('*').eq('id', imageId).single(),
      supabase.from('event_images').select('id').eq('event_id', eventId).order('unlocks_at', { ascending: true }).order('sort_order', { ascending: true }),
      supabase.from('player_attempts')
        .select('user_id, is_correct, points, time_seconds, attempted_at, profile:profiles(username, avatar_url, equipped_frame)')
        .eq('image_id', imageId),
    ])
    setImage(imgRes.data)
    setEditDesc(imgRes.data?.description ?? '')
    const idx = (orderRes.data ?? []).findIndex(r => r.id === imageId)
    setIndex(idx >= 0 ? idx : 0)
    const rows = (attRes.data ?? []) as unknown as AttemptRow[]
    rows.sort((a, b) => (b.is_correct ? 1 : 0) - (a.is_correct ? 1 : 0) || b.points - a.points || a.time_seconds - b.time_seconds)
    setAttempts(rows)
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

  const finds = attempts.filter(a => a.is_correct).length

  return (
    <div className="p-4 max-w-2xl mx-auto pt-2">
      <div className="flex items-center gap-3 mb-4 safe-top">
        <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-white">Bild {index + 1} · Admin-Ansicht</h1>
          <p className="text-white/50 text-xs">Freigeschaltet: {new Date(image.unlocks_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <GameCard className="mb-4">
        <h2 className="font-extrabold text-slate-800 mb-3">🎯 Marker bearbeiten</h2>
        <DescriptionInput value={editDesc} onChange={setEditDesc} />
        <div className="mt-3">
          <BoundingBoxEditor image={image} onSave={saveMarker} />
        </div>
      </GameCard>

      <GameCard>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Wer hat gespielt</h2>
          <span className="text-xs font-bold text-slate-500">{attempts.length} gespielt · {finds} gefunden</span>
        </div>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Noch niemand hat dieses Bild gespielt.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {attempts.map(a => (
              <div key={a.user_id} className="flex items-center gap-3 bg-white/60 rounded-2xl px-3 py-2">
                <FramedAvatar url={a.profile?.avatar_url} name={a.profile?.username} frame={a.profile?.equipped_frame} size={36} className="text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-slate-800 truncate">{a.profile?.username ?? '—'}</p>
                  <p className="text-xs text-slate-500">{a.time_seconds}s · {new Date(a.attempted_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</p>
                </div>
                {a.is_correct ? (
                  <span className="text-sm font-extrabold text-green-600 flex-shrink-0">✓ {a.points} Pkt</span>
                ) : (
                  <span className="text-sm font-extrabold text-red-500 flex-shrink-0">✗ Daneben</span>
                )}
              </div>
            ))}
          </div>
        )}
      </GameCard>
    </div>
  )
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
