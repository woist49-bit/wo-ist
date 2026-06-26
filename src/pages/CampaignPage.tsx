import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GameCard } from '../components/ui/GameCard'
import type { Campaign, EventImage } from '../types'

export function CampaignPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map()) // image_id -> abgeschlossen?
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (campaignId && user) load() }, [campaignId, user])

  async function load() {
    const { data: camp } = await supabase.from('campaigns').select('*').eq('id', campaignId).single()
    setCampaign(camp)

    let imgs: EventImage[] = []
    if (camp) {
      const q = camp.original_event_id
        ? supabase.from('event_images').select('*').eq('event_id', camp.original_event_id)
        : supabase.from('event_images').select('*').eq('campaign_id', camp.id)
      const { data } = await q.order('sort_order')
      imgs = data ?? []
    }
    setImages(imgs)

    if (imgs.length) {
      const ids = imgs.map(i => i.id)
      // Abgeschlossen = im Kampagnen-Fortschritt gefunden ODER live korrekt gefunden
      const [attRes, progRes] = await Promise.all([
        supabase.from('player_attempts').select('image_id, is_correct').eq('user_id', user!.id).in('image_id', ids),
        supabase.from('campaign_progress').select('image_id, found').eq('campaign_id', campaignId).eq('user_id', user!.id).in('image_id', ids),
      ])
      const done = new Map<string, boolean>()
      for (const a of attRes.data ?? []) if (a.is_correct) done.set(a.image_id, true)
      for (const p of progRes.data ?? []) if (p.found) done.set(p.image_id, true)
      setProgress(done)
    }
    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (!campaign) return <div className="p-8 text-center text-white/50">Kampagne nicht gefunden.</div>

  const isEventCampaign = !!campaign.original_event_id
  const doneCount = images.filter(i => progress.get(i.id)).length

  return (
    <div className="p-4 max-w-lg mx-auto pt-4 pb-8">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-extrabold text-white">{campaign.title}</h1>
        {campaign.is_legacy && <span className="text-xs font-bold text-amber-300 border border-amber-300/50 rounded-full px-2 py-0.5">Legacy</span>}
      </div>
      <p className="text-white/60 font-semibold mb-4">{doneCount} / {images.length} Bilder geschafft</p>

      <GameCard className="mb-6 !bg-[#efe2c4] !border-[#dcc99c] text-xs text-slate-600 py-3">
        {isEventCampaign
          ? 'Wer beim Live-Event dabei war, spielt ohne Punkte. Neue Spieler bekommen Punkte beim ersten Fund. Bilder sind beliebig wiederholbar und schalten der Reihe nach frei.'
          : 'Finde die gesuchte Person auf jedem Bild. Punkte gibt\'s beim ersten Fund, danach beliebig wiederholbar. Bilder schalten der Reihe nach frei.'}
      </GameCard>

      {images.length === 0 ? (
        <GameCard className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold">Noch keine Bilder in dieser Kampagne.</p>
        </GameCard>
      ) : (
        <div className="flex flex-col gap-3">
          {images.map((img, idx) => {
            const done = !!progress.get(img.id)
            const unlocked = idx === 0 || !!progress.get(images[idx - 1].id)
            return (
              <button
                key={img.id}
                disabled={!unlocked}
                onClick={() => unlocked && navigate(`/world/${worldId}/campaign/${campaignId}/image/${img.id}`)}
                className={`w-full text-left ${unlocked ? 'active:translate-y-[2px] transition-transform' : 'cursor-not-allowed'}`}
              >
                <GameCard className={unlocked ? '' : 'opacity-60'}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-300 flex-shrink-0">
                      {unlocked ? (
                        <>
                          <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                          {done && <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow">✓</div>}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🔒</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-800">Bild {idx + 1}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {!unlocked ? 'Erst das vorherige Bild finden' : done ? '✓ Geschafft' : 'Noch offen'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-sm font-bold">
                      {!unlocked ? <span className="text-slate-400">🔒</span>
                        : done ? <span className="text-green-600">Wiederholen →</span>
                        : <span className="text-violet-600">Spielen →</span>}
                    </div>
                  </div>
                </GameCard>
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
