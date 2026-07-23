import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, PartyPopper, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../stores/notifications'
import { isHit } from '../lib/scoring'
import { TUTORIAL_SLIDES, TUTORIAL_IMAGES, TUTORIAL_ACHIEVEMENT_KEY, type TutorialImage } from '../lib/tutorial'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'
import { ImageMarkerViewer, type ViewerMarker } from '../components/marker/ImageMarkerViewer'

export function TutorialPage() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const { triggerAchievement } = useNotifications()
  const [phase, setPhase] = useState<'slides' | 'game' | 'done'>('slides')
  const [slide, setSlide] = useState(0)
  const [imgIdx, setImgIdx] = useState(0)
  const doneRef = useRef(false)

  // Beim Erreichen des Abschluss-Screens: Tutorial als abgeschlossen markieren +
  // Achievement einmalig global vergeben (RPC ist idempotent). doneRef verhindert Doppelaufruf.
  useEffect(() => {
    if (phase !== 'done' || !user || doneRef.current) return
    doneRef.current = true
    ;(async () => {
      const { data: isNew } = await supabase.rpc('complete_tutorial', { p_user_id: user.id })
      refreshProfile()
      if (isNew) triggerAchievement(TUTORIAL_ACHIEVEMENT_KEY)
    })()
  }, [phase, user, refreshProfile, triggerAchievement])

  // ---------- Teil 1: Info-Slideshow ----------
  if (phase === 'slides') {
    const s = TUTORIAL_SLIDES[slide]
    const Icon = s.icon
    const isLastSlide = slide === TUTORIAL_SLIDES.length - 1
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col">
        {/* Jederzeit rauskommen – Tutorial ist wiederholbar, kein Fortschritt geht verloren. */}
        <div className="px-3 pt-2 pb-1 safe-top flex justify-end flex-shrink-0">
          <IconButton variant="grey" onClick={() => navigate('/worlds')} aria-label="Tutorial verlassen"><X size={22} strokeWidth={2.5} /></IconButton>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center min-h-0">
          <div className="w-24 h-24 rounded-[1.75rem] bg-white flex items-center justify-center shadow-[0_6px_0_rgba(0,0,0,0.25)] mb-7">
            <Icon size={52} strokeWidth={2} className="text-violet-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-3">{s.title}</h2>
          <p className="text-white/80 leading-relaxed max-w-sm">{s.text}</p>
        </div>

        <div className="px-6 pb-8 safe-area-pb">
          <div className="max-w-md mx-auto">
            <div className="flex justify-center gap-2 mb-5">
              {TUTORIAL_SLIDES.map((_, i) => (
                <span key={i} className={`h-2.5 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-2.5 bg-white/35'}`} />
              ))}
            </div>
            <Button variant="success" size="lg" className="w-full" onClick={() => {
              if (!isLastSlide) setSlide(slide + 1)
              else { setImgIdx(0); setPhase('game') }
            }}>Weiter</Button>
            {slide === 0 && (
              <button
                onClick={() => { setImgIdx(0); setPhase('game') }}
                className="block mx-auto mt-4 text-white/60 hover:text-white/80 text-sm font-semibold transition-colors"
              >
                Überspringen
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- Teil 2: Interaktive Übungsbilder ----------
  if (phase === 'game') {
    return (
      <TutorialImageStep
        key={imgIdx}
        image={TUTORIAL_IMAGES[imgIdx]}
        isLast={imgIdx === TUTORIAL_IMAGES.length - 1}
        onExit={() => navigate('/worlds')}
        onBack={() => {
          if (imgIdx > 0) setImgIdx(imgIdx - 1)
          else { setSlide(TUTORIAL_SLIDES.length - 1); setPhase('slides') }
        }}
        onNext={() => {
          if (imgIdx < TUTORIAL_IMAGES.length - 1) setImgIdx(imgIdx + 1)
          else setPhase('done')
        }}
      />
    )
  }

  // ---------- Abschluss-Screen ----------
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex items-center justify-center p-6">
      <GameCard className="w-full max-w-sm text-center animate-pop-in">
        <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
          <PartyPopper size={44} strokeWidth={2} className="text-violet-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Tutorial abgeschlossen!</h2>
        <p className="text-slate-600 mb-6">Du weißt jetzt alles was du brauchst. Viel Spaß beim Suchen!</p>
        <Button variant="success" size="lg" className="w-full" onClick={() => navigate('/worlds')}>Los geht's</Button>
      </GameCard>
    </div>
  )
}

function TutorialImageStep({ image, isLast, onNext, onBack, onExit }: {
  image: TutorialImage
  isLast: boolean
  onNext: () => void
  onBack: () => void
  onExit: () => void
}) {
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const [revealed, setRevealed] = useState(false)

  const t = image.target
  // Trefferradius als Pixel (Bruchteil der kürzeren Seite) – identisch zum echten Spiel
  const radiusPx = nat.w > 0 ? t.radius_rel * Math.min(nat.w, nat.h) : 0
  const hit = !!tip && nat.w > 0 && isHit(tip.x, tip.y, t.x_rel, t.y_rel, t.radius_rel, nat.w, nat.h)
  const canPlace = !image.guided && !revealed

  const markers: ViewerMarker[] = []
  if (image.guided) {
    // Ziel von Anfang an sichtbar (pulsierender Kreis)
    markers.push({ x_rel: t.x_rel, y_rel: t.y_rel, radius_px: radiusPx, variant: 'ring', color: '#22c55e', pulse: true })
  } else {
    if (!revealed && tip) markers.push({ x_rel: tip.x, y_rel: tip.y, variant: 'pin', color: '#818cf8' })
    if (revealed) {
      markers.push({ x_rel: t.x_rel, y_rel: t.y_rel, radius_px: radiusPx, variant: 'ring', color: hit ? '#22c55e' : '#eab308', pulse: true })
      if (tip) markers.push({ x_rel: tip.x, y_rel: tip.y, variant: 'pin', color: hit ? '#22c55e' : '#ef4444' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute inset-0">
        <ImageMarkerViewer
          imageUrl={image.src}
          markers={markers}
          height="100%"
          interactive={canPlace}
          onReady={(w, h) => setNat({ w, h })}
          onTap={(x, y) => { if (canPlace) setTip({ x, y }) }}
        />
      </div>

      {/* Oben: Zurück-Button + Hinweis-Banner */}
      <div className="absolute top-0 inset-x-0 z-20 px-3 pb-3 safe-top bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-start gap-3 max-w-lg mx-auto">
          <IconButton variant="grey" onClick={onBack} aria-label="Zurück"><ChevronLeft size={22} strokeWidth={2.5} /></IconButton>
          <div className="flex-1 bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-2xl px-3.5 py-2.5 shadow-[0_4px_0_#00000022]">
            <p className="text-sm font-semibold text-slate-700 leading-snug">{image.hint}</p>
          </div>
          <IconButton variant="grey" onClick={onExit} aria-label="Tutorial verlassen"><X size={22} strokeWidth={2.5} /></IconButton>
        </div>
      </div>

      {/* Unten: Aktion + Auflösungs-Feedback (kein Timer, keine Punkte) */}
      <div className="absolute bottom-0 inset-x-0 z-30 px-4 pt-10 safe-area-pb bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="max-w-md mx-auto">
          {revealed && !image.guided && (
            <p className={`text-center font-extrabold mb-3 ${hit ? 'text-green-400' : 'text-amber-300'}`}>
              {hit ? '🎉 Gefunden!' : '🔍 So sieht die Auflösung aus.'}
            </p>
          )}
          {image.guided ? (
            <Button variant="success" size="lg" className="w-full" onClick={onNext}>Weiter</Button>
          ) : !revealed ? (
            <Button variant="success" size="lg" className="w-full" disabled={!tip} onClick={() => setRevealed(true)}>
              {tip ? '✓ Bestätigen' : 'Tippe auf die Person'}
            </Button>
          ) : (
            <Button variant="success" size="lg" className="w-full" onClick={onNext}>{isLast ? 'Fertig' : 'Weiter'}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
