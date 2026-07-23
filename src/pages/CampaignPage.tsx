import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Lock, Search, X, Globe, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GameCard } from '../components/ui/GameCard'
import { Button } from '../components/ui/Button'
import type { Campaign, EventImage } from '../types'

export function CampaignPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [images, setImages] = useState<EventImage[]>([])
  // image_id -> erreichte Punktzahl (Vorhandensein im Map = abgeschlossen)
  const [done, setDone] = useState<Map<string, number>>(new Map())
  const [isAdmin, setIsAdmin] = useState(false) // Admin dieser Welt -> verwaltet, spielt nicht
  const [loading, setLoading] = useState(true)
  const [popupImg, setPopupImg] = useState<EventImage | null>(null) // Vorschau-Popup wie im Live-Event

  useEffect(() => { if (campaignId && user) load() }, [campaignId, user])

  async function load() {
    const [{ data: camp }, roleRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('world_members').select('role').eq('world_id', worldId).eq('user_id', user!.id).maybeSingle(),
    ])
    setIsAdmin(roleRes.data?.role === 'admin')
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
        supabase.from('player_attempts').select('image_id, is_correct, points').eq('user_id', user!.id).in('image_id', ids),
        supabase.from('campaign_progress').select('image_id, found, points').eq('campaign_id', campaignId).eq('user_id', user!.id).in('image_id', ids),
      ])
      const map = new Map<string, number>()
      for (const a of attRes.data ?? []) if (a.is_correct) map.set(a.image_id, a.points ?? 0)
      for (const p of progRes.data ?? []) if (p.found) map.set(p.image_id, Math.max(map.get(p.image_id) ?? 0, p.points ?? 0))
      setDone(map)
    }
    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (!campaign) return <div className="p-8 text-center text-white/50">Kampagne nicht gefunden.</div>

  const isEventCampaign = !!campaign.original_event_id
  const doneCount = images.filter(i => done.has(i.id)).length
  const origin = campaign.original_event_id

  // Admin: Bild öffnen -> Admin-Bild-Ansicht (Event-Kampagne über Event, sonst über Kampagne)
  const openImage = (img: EventImage) => {
    if (isAdmin) {
      navigate(origin
        ? `/world/${worldId}/admin/event/${origin}/image/${img.id}`
        : `/world/${worldId}/admin/campaign/${campaignId}/image/${img.id}`)
    } else {
      navigate(`/world/${worldId}/campaign/${campaignId}/image/${img.id}`)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto pt-4 pb-8">
      {/* Modus-Identität: große violette Globus-Pille MIT dem Kampagnen-Titel (Farbe + Globus = Kampagne). */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="inline-flex items-center gap-2.5 bg-violet-500 text-white rounded-full px-5 py-2.5 max-w-full shadow-[0_4px_0_#5b21b6,inset_0_1px_0_#ffffff80]">
          <Globe size={20} strokeWidth={2.75} className="flex-shrink-0" />
          <span className="text-xl font-extrabold leading-tight break-words">{campaign.title}</span>
        </div>
        {campaign.is_legacy && <span className="text-xs font-bold text-amber-300 border border-amber-300/50 rounded-full px-2 py-0.5">Legacy</span>}
      </div>
      {isAdmin
        ? <p className="text-sky-300 font-semibold mb-4">👑 Admin – du verwaltest diese Kampagne</p>
        : <p className="text-white/60 font-semibold mb-4">{doneCount} von {images.length} gefunden</p>}

      {!isAdmin && (
        <GameCard className="mb-6 !bg-[#efe2c4] !border-[#dcc99c] text-xs text-slate-600 py-3">
          {isEventCampaign
            ? 'Wer beim Live-Event dabei war, spielt ohne Punkte. Neue Spieler bekommen Punkte beim ersten Fund. Bilder sind beliebig wiederholbar und schalten der Reihe nach frei.'
            : 'Finde die gesuchte Person auf jedem Bild. Punkte gibt\'s beim ersten Fund, danach beliebig wiederholbar. Bilder schalten der Reihe nach frei.'}
        </GameCard>
      )}

      {images.length === 0 ? (
        <GameCard className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold">Noch keine Bilder in dieser Kampagne.</p>
        </GameCard>
      ) : (
        <div className="flex flex-col gap-3">
          {images.map((img, idx) => {
            const completed = done.has(img.id)
            const pts = done.get(img.id) ?? 0
            const unlocked = idx === 0 || done.has(images[idx - 1].id)
            const tappable = isAdmin || completed || unlocked   // Admins können jedes Bild öffnen
            const current = unlocked && !completed
            return (
              <button
                key={img.id}
                disabled={!tappable}
                onClick={() => { if (!tappable) return; isAdmin ? openImage(img) : setPopupImg(img) }}
                className={`w-full text-left ${tappable ? 'active:translate-y-[2px] transition-transform' : 'cursor-default'}`}
              >
                <GameCard className={isAdmin ? '!border-sky-300' : !tappable ? 'opacity-50' : current ? '!border-violet-400' : ''}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-300 flex-shrink-0 flex items-center justify-center">
                      {!tappable ? (
                        <Lock size={22} strokeWidth={2.5} className="text-slate-500" />
                      ) : (
                        <>
                          {/* Aktives, noch nicht gefundenes Bild unscharf – wie im Live-Event, damit
                              man die Person nicht schon in der Miniatur suchen kann. */}
                          <img src={img.image_url} alt="" className={`w-full h-full object-cover ${!isAdmin && !completed ? 'blur-[5px] scale-110' : ''}`} />
                          {!isAdmin && !completed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                              <Search size={20} strokeWidth={2.5} />
                            </div>
                          )}
                          {!isAdmin && completed && <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow">✓</div>}
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-800">Bild {idx + 1}</p>
                      {tappable && img.description && (
                        <div className="flex items-start gap-1.5 mt-1">
                          <Info size={13} strokeWidth={2.75} className="text-violet-500 flex-shrink-0 mt-[3px]" />
                          <p className="text-[13px] text-slate-700 font-medium leading-snug line-clamp-2">{img.description}</p>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isAdmin ? 'Admin-Ansicht'
                          : completed ? (pts > 0 ? `✓ Geschafft · ${pts} Punkte` : '✓ Geschafft')
                          : current ? 'Jetzt spielen' : 'Gesperrt'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-sm font-bold">
                      {isAdmin ? <span className="text-sky-600">Verwalten →</span>
                        : completed ? <span className="text-green-600">Wiederholen →</span>
                        : current ? <span className="text-violet-600">Spielen →</span>
                        : null}
                    </div>
                  </div>
                </GameCard>
              </button>
            )
          })}
        </div>
      )}

      {/* Vorschau-Popup wie im Live-Event: unscharfes Bild, Status, „Spielen". Nur für Spieler
          (Admins gehen direkt in die Verwaltung). Debuffs/Buffs gibt es in Kampagnen nicht. */}
      {popupImg && (() => {
        const idx = images.findIndex(i => i.id === popupImg.id)
        const completed = done.has(popupImg.id)
        const pts = done.get(popupImg.id) ?? 0
        return (
          <div className="fixed inset-0 z-[65] bg-black/60 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={() => setPopupImg(null)}>
            <div
              className="w-full max-w-sm bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-3xl shadow-[0_8px_0_#0000002e] flex flex-col animate-pop-in overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative flex-shrink-0">
                <div className="relative h-28 bg-slate-300 overflow-hidden flex items-center justify-center">
                  {/* Vor dem ersten Fund unscharf, danach scharf (schon gefunden). */}
                  <img src={popupImg.image_url} alt="" className={`w-full h-full object-cover ${!completed ? 'blur-md scale-110' : ''}`} />
                  {!completed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-black/45 rounded-full px-3 py-1">
                        <Search size={14} strokeWidth={2.5} /> Erst beim Spielen scharf
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPopupImg(null)}
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="Schließen"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
                <div className="absolute bottom-2 left-3">
                  <span className="inline-block bg-black/50 text-white text-sm font-extrabold rounded-full px-3 py-1">Bild {idx + 1}</span>
                </div>
              </div>

              <div className="px-4 py-3">
                {completed ? (
                  <p className="text-center text-green-600 font-extrabold text-lg">
                    🎉 Gefunden!{pts > 0 ? <span className="text-slate-500 font-semibold text-sm"> · {pts} Punkte</span> : ''}
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">Finde die gesuchte Person auf diesem Bild.</p>
                )}
                {popupImg.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{popupImg.description}</p>}
              </div>

              <div className="p-4 pt-1">
                <Button
                  variant={completed ? 'secondary' : 'success'}
                  size="lg"
                  className="w-full"
                  onClick={() => { const t = popupImg; setPopupImg(null); openImage(t) }}
                >
                  {completed ? 'Nochmal spielen' : '▶ Spielen'}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
