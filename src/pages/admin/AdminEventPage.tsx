import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { BoundingBoxEditor } from '../../components/marker/BoundingBoxEditor'
import type { LiveEvent, EventImage } from '../../types'

export function AdminEventPage() {
  const { worldId, eventId } = useParams<{ worldId: string; eventId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState<LiveEvent | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  const [loading, setLoading] = useState(true)

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [unlocksDate, setUnlocksDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { load() }, [eventId])

  async function load() {
    const [evRes, imgRes] = await Promise.all([
      supabase.from('live_events').select('*').eq('id', eventId).single(),
      supabase.from('event_images').select('*').eq('event_id', eventId).order('sort_order'),
    ])
    setEvent(evRes.data)
    setImages(imgRes.data ?? [])
    setLoading(false)
  }

  async function uploadImage() {
    if (!user || !selectedFile || !unlocksDate || !event) {
      setUploadError('Datei und Freischaltungsdatum erforderlich.')
      return
    }
    setUploading(true)
    setUploadError('')

    const path = `${worldId}/${eventId}/${Date.now()}_${selectedFile.name}`
    const { error: uploadErr } = await supabase.storage.from('game-images').upload(path, selectedFile)
    if (uploadErr) { setUploadError(uploadErr.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('game-images').getPublicUrl(path)
    // Kombiniere Datum mit Event-Uhrzeit
    const unlocksAt = new Date(`${unlocksDate}T${String(event.daily_release_hour).padStart(2, '0')}:${String(event.daily_release_minute).padStart(2, '0')}:00`).toISOString()

    const { data: img, error: dbErr } = await supabase.from('event_images').insert({
      event_id: eventId,
      world_id: worldId,
      image_url: urlData.publicUrl,
      unlocks_at: unlocksAt,
      sort_order: images.length + 1,
      target_x: 0.5,
      target_y: 0.5,
      target_radius: 0.05,
      uploaded_by: user.id,
    }).select().single()

    setUploading(false)
    if (dbErr) { setUploadError(dbErr.message); return }

    if (img) {
      setImages(prev => [...prev, img])
      setSelectedFile(null)
      setUnlocksDate('')
      setEditingId(img.id)
    }
  }

  async function deleteImage(id: string) {
    if (!confirm('Bild wirklich löschen?')) return
    await supabase.from('event_images').delete().eq('id', id)
    setImages(prev => prev.filter(i => i.id !== id))
  }

  async function activateEvent() {
    if (images.length === 0) { alert('Mindestens 1 Bild erforderlich.'); return }
    await supabase.from('live_events').update({ status: 'active' }).eq('id', eventId)
    setEvent(e => e ? { ...e, status: 'active' } : null)
  }

  if (loading) return <LoadingScreen />
  if (!event) return <div className="p-8 text-center text-white/50">Event nicht gefunden.</div>

  return (
    <div className="p-4 max-w-2xl mx-auto pt-6">
      <button onClick={() => navigate(`/world/${worldId}/admin`)} className="text-white/40 text-sm mb-4 hover:text-white/70">← Admin</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{event.title}</h1>
          <p className="text-white/40 text-sm mt-1">
            {new Date(event.starts_at).toLocaleString('de-DE')} – {new Date(event.ends_at).toLocaleString('de-DE')}
          </p>
          {event.description && <p className="text-white/50 text-sm mt-2 italic">{event.description}</p>}
        </div>
        {event.status === 'draft' && (
          <Button size="sm" onClick={activateEvent}>Aktivieren</Button>
        )}
        {event.status === 'active' && (
          <span className="px-3 py-1 bg-green-900 text-green-300 text-xs rounded-full">🔴 Live</span>
        )}
      </div>

      <Card className="mb-6 p-6 border-indigo-500/30 bg-indigo-900/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">📷 Bilder hochladen</h2>
          <p className="text-xs text-white/40">Freischaltung täglich um {String(event?.daily_release_hour).padStart(2, '0')}:{String(event?.daily_release_minute).padStart(2, '0')}</p>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-white/70 block mb-2">Bild auswählen</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-white/50 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
            {selectedFile && <p className="text-xs text-indigo-300 mt-1">{selectedFile.name}</p>}
          </div>
          {selectedFile && (
            <>
              <Input
                label="Freischaltungsdatum"
                type="date"
                value={unlocksDate}
                onChange={e => setUnlocksDate(e.target.value)}
                autoFocus
              />
              {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}
              <Button
                loading={uploading}
                onClick={uploadImage}
                disabled={!unlocksDate}
                className="w-full"
              >
                Hochladen
              </Button>
            </>
          )}
        </div>
      </Card>

      {images.length === 0 ? (
        <Card className="text-center py-12 text-white/40">
          <p className="text-4xl mb-3">📭</p>
          <p>Keine Bilder hochgeladen. Beginne oben!</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">Hochgeladene Bilder ({images.length})</h2>
          {images.map((img, idx) => (
            <Card key={img.id} className={editingId === img.id ? 'border-yellow-500/50 bg-yellow-900/10' : ''}>
              <div className="flex items-start gap-4 mb-3">
                <img src={img.image_url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">Bild {idx + 1}</p>
                  <p className="text-xs text-white/40 mt-1">
                    {new Date(img.unlocks_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingId(editingId === img.id ? null : img.id)}
                  >
                    {editingId === img.id ? 'Fertig' : '✎'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteImage(img.id)}>✕</Button>
                </div>
              </div>

              {editingId === img.id && (
                <BoundingBoxEditor image={img} onSave={async (tx, ty, tr) => {
                  await supabase.from('event_images').update({ target_x: tx, target_y: ty, target_radius: tr }).eq('id', img.id)
                  setImages(prev => prev.map(i => i.id === img.id ? { ...i, target_x: tx, target_y: ty, target_radius: tr } : i))
                  setEditingId(null)
                }} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
