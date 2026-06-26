import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { GameCard } from '../../components/ui/GameCard'
import { BoundingBoxEditor } from '../../components/marker/BoundingBoxEditor'
import type { Campaign, EventImage } from '../../types'

export function AdminCampaignPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [campaignId])

  async function load() {
    const { data: camp } = await supabase.from('campaigns').select('*').eq('id', campaignId).single()
    setCampaign(camp)
    if (camp) {
      const q = camp.original_event_id
        ? supabase.from('event_images').select('*').eq('event_id', camp.original_event_id)
        : supabase.from('event_images').select('*').eq('campaign_id', camp.id)
      const { data } = await q.order('sort_order')
      setImages(data ?? [])
    }
    setLoading(false)
  }

  async function uploadImage() {
    if (!user || !selectedFile) { setUploadError('Bild auswählen.'); return }
    setUploading(true); setUploadError('')

    const path = `${worldId}/campaign/${campaignId}/${Date.now()}_${selectedFile.name}`
    const { error: upErr } = await supabase.storage.from('game-images').upload(path, selectedFile)
    if (upErr) { setUploadError(upErr.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('game-images').getPublicUrl(path)
    const { data: img, error: dbErr } = await supabase.from('event_images').insert({
      campaign_id: campaignId,
      world_id: worldId,
      image_url: urlData.publicUrl,
      unlocks_at: new Date().toISOString(),
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
      if (fileRef.current) fileRef.current.value = ''
      setEditingId(img.id)
    }
  }

  async function deleteImage(id: string) {
    if (!confirm('Bild wirklich löschen?')) return
    await supabase.from('event_images').delete().eq('id', id)
    setImages(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <LoadingScreen />
  if (!campaign) return <div className="p-8 text-center text-white/50">Kampagne nicht gefunden.</div>

  const isEventCampaign = !!campaign.original_event_id

  return (
    <div className="p-4 max-w-2xl mx-auto pt-4">
      <h1 className="text-2xl font-extrabold text-white mb-1">{campaign.title}</h1>
      <p className="text-white/50 text-sm mb-6">{campaign.is_legacy ? 'Legacy-Kampagne' : 'Event-Kampagne'}</p>

      {isEventCampaign ? (
        <GameCard className="text-center py-8 text-slate-500 text-sm font-semibold">
          Diese Kampagne nutzt die Bilder des Original-Events.<br />Bearbeite die Markierungen direkt im Event.
        </GameCard>
      ) : (
        <>
          <GameCard className="mb-6">
            <h2 className="font-extrabold text-slate-800 mb-4">📷 Bild hochladen</h2>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-violet-500 file:text-white file:font-bold hover:file:bg-violet-600 cursor-pointer"
            />
            {selectedFile && <p className="text-xs text-violet-600 font-medium mt-2">{selectedFile.name}</p>}
            {uploadError && <p className="text-red-600 text-sm font-medium mt-2">{uploadError}</p>}
            {selectedFile && <Button variant="success" loading={uploading} onClick={uploadImage} className="w-full mt-3">Hochladen</Button>}
          </GameCard>

          {images.length === 0 ? (
            <GameCard className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-semibold">Keine Bilder. Lade oben welche hoch!</p>
            </GameCard>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">Bilder ({images.length})</h2>
              {images.map((img, idx) => (
                <GameCard key={img.id} className={editingId === img.id ? '!border-yellow-400' : ''}>
                  <div className="flex items-start gap-4">
                    <img src={img.image_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-800">Bild {idx + 1}</p>
                      <p className="text-xs text-slate-500 mt-1">{img.target_x !== 0.5 || img.target_y !== 0.5 ? '✓ Markiert' : '⚠ Noch nicht markiert'}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(editingId === img.id ? null : img.id)}>
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
                </GameCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
