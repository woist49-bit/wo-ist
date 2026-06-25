import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/ui/Card'
import type { Campaign, EventImage, PlayerAttempt } from '../types'

export function CampaignPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  const [attempts, setAttempts] = useState<Map<string, PlayerAttempt>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (campaignId && user) load() }, [campaignId, user])

  async function load() {
    const { data: camp } = await supabase.from('campaigns').select('*').eq('id', campaignId).single()
    setCampaign(camp)

    let imgs: EventImage[] = []
    if (camp) {
      // Event-Kampagne: Bilder des Original-Events. Legacy: eigene Bilder über campaign_id.
      const q = camp.original_event_id
        ? supabase.from('event_images').select('*').eq('event_id', camp.original_event_id)
        : supabase.from('event_images').select('*').eq('campaign_id', camp.id)
      const { data } = await q.order('sort_order')
      imgs = data ?? []
    }
    setImages(imgs)

    if (imgs.length) {
      const { data: att } = await supabase.from('player_attempts').select('*').eq('user_id', user!.id).in('image_id', imgs.map(i => i.id))
      const map = new Map<string, PlayerAttempt>()
      for (const a of att ?? []) map.set(a.image_id, a)
      setAttempts(map)
    }
    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (!campaign) return <div className="p-8 text-center text-white/50">Kampagne nicht gefunden.</div>

  const totalPoints = Array.from(attempts.values()).reduce((s, a) => s + a.points, 0)
  const isEventCampaign = !!campaign.original_event_id

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <button onClick={() => navigate(`/world/${worldId}`)} className="text-white/40 text-sm mb-4 hover:text-white/70">← Zurück</button>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
        {campaign.is_legacy && <span className="text-xs text-amber-400 border border-amber-400/40 rounded-full px-2 py-0.5">Legacy</span>}
      </div>
      <p className="text-indigo-400 font-semibold mb-4">Deine Punkte: {totalPoints}</p>

      <Card className="mb-6 bg-white/5 text-xs text-white/50 py-3">
        {isEventCampaign
          ? 'Wer beim ursprünglichen Live-Event schon dabei war, kann hier nur üben – ohne Punkte. Wer es verpasst hat oder neu ist, bekommt reguläre Punkte (1 Versuch pro Bild).'
          : 'Spiele die Bilder – beim ersten Durchspielen zählen die Punkte für die Rangliste (1 Versuch pro Bild).'}
      </Card>

      {images.length === 0 ? (
        <Card className="text-center py-12 text-white/40">
          <p className="text-4xl mb-3">📭</p>
          <p>Noch keine Bilder in dieser Kampagne.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {images.map((img, idx) => {
            const att = attempts.get(img.id)
            const played = !!att
            return (
              <button key={img.id} onClick={() => navigate(`/world/${worldId}/campaign/${campaignId}/image/${img.id}`)} className="w-full text-left">
                <Card className={`hover:bg-white/10 transition-colors ${played ? 'border-white/5' : 'border-indigo-500/30'}`}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      {!played && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="text-2xl">🔍</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">Bild {idx + 1}</p>
                      {played
                        ? <p className="text-xs text-white/40">{att.is_correct ? 'Gefunden' : 'Daneben'} · Üben möglich</p>
                        : <p className="text-xs text-indigo-400">Noch nicht gespielt</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {played ? (
                        <div className={att.is_correct ? 'text-green-400' : 'text-red-400'}>
                          <p className="font-bold">{att.is_correct ? `+${att.points}` : '✗'}</p>
                          <p className="text-xs opacity-70">{att.time_seconds}s</p>
                        </div>
                      ) : (
                        <span className="text-indigo-400 text-sm font-medium">Spielen →</span>
                      )}
                    </div>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
