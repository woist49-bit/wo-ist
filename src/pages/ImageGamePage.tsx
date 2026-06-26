import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../stores/toast'
import { calcPoints, isHit, distanceFraction } from '../lib/scoring'
import { ACHIEVEMENT_MAP } from '../lib/achievements'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'
import { ImageMarkerViewer, type ViewerMarker } from '../components/marker/ImageMarkerViewer'
import type { EventImage, PlayerAttempt } from '../types'

export function ImageGamePage() {
  const { worldId, imageId, campaignId } = useParams<{ worldId: string; imageId: string; campaignId: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const isCampaign = !!campaignId

  const [image, setImage] = useState<EventImage | null>(null)
  const [attempt, setAttempt] = useState<PlayerAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)

  // Übungsmodus (Kampagne, Spieler hat schon einen Versuch): kein Speichern, keine Punkte
  const [practice, setPractice] = useState(false)
  const [practiceRevealed, setPracticeRevealed] = useState(false)
  const [practiceHit, setPracticeHit] = useState<boolean | null>(null)

  // Abbruch-Dialog (nur Live-Event, Zurück vor dem Bestätigen)
  const [showAbort, setShowAbort] = useState(false)

  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => { if (imageId && user) load() }, [imageId, user])

  async function load() {
    const [imgRes, attemptRes] = await Promise.all([
      supabase.from('event_images').select('*').eq('id', imageId).single(),
      supabase.from('player_attempts').select('*').eq('image_id', imageId).eq('user_id', user!.id).maybeSingle(),
    ])
    setImage(imgRes.data)
    if (attemptRes.data) {
      setAttempt(attemptRes.data)
      setTip({ x: attemptRes.data.click_x, y: attemptRes.data.click_y })
      setRevealed(true)
    }
    startTimeRef.current = Date.now()
    setLoading(false)
  }

  // "placing" = der Spieler setzt gerade seinen Tipp (weder echtes noch Übungs-Ergebnis sichtbar)
  const placing = !revealed && !practiceRevealed

  useEffect(() => {
    if (!placing || practice) return
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000))
    }, 100)
    return () => clearInterval(interval)
  }, [placing, practice])

  async function confirmClick() {
    if (!tip || !image || !user || !nat.w) return
    const seconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    const hit = isHit(tip.x, tip.y, image.target_x, image.target_y, image.target_radius, nat.w, nat.h)

    // Übungsmodus: nur Ergebnis zeigen, nichts speichern
    if (practice) {
      setPracticeHit(hit)
      setPracticeRevealed(true)
      return
    }

    setSubmitting(true)
    const points = hit ? calcPoints(seconds) : 0
    const dist = distanceFraction(tip.x, tip.y, image.target_x, image.target_y)

    const { data } = await supabase.from('player_attempts').insert({
      image_id: image.id,
      user_id: user.id,
      click_x: tip.x,
      click_y: tip.y,
      is_correct: hit,
      points,
      time_seconds: seconds,
    }).select().single()

    if (data) {
      setAttempt(data)
      if (hit) {
        await supabase.rpc('add_xp', { p_user_id: user.id, p_xp: points, p_world_id: worldId })
      }
      await checkAchievements({ hit, seconds, dist })
    }
    setRevealed(true)
    setSubmitting(false)
  }

  function enterPractice() {
    setPractice(true)
    setRevealed(false)
    setPracticeRevealed(false)
    setPracticeHit(null)
    setTip(null)
    startTimeRef.current = Date.now()
  }

  function resetPractice() {
    setPracticeRevealed(false)
    setPracticeHit(null)
    setTip(null)
  }

  // Live-Event: Zurück VOR dem Bestätigen -> Abbruch-Dialog. Sonst (Kampagne, oder schon aufgelöst): direkt zurück.
  function handleBack() {
    if (!isCampaign && placing) setShowAbort(true)
    else navigate(-1)
  }

  // Abbruch bestätigt: Versuch als verbraucht (0 Punkte) speichern und zurück.
  async function abortConfirm() {
    if (!image || !user) { navigate(-1); return }
    setSubmitting(true)
    const seconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    await supabase.from('player_attempts').insert({
      image_id: image.id,
      user_id: user.id,
      click_x: tip?.x ?? 0,
      click_y: tip?.y ?? 0,
      is_correct: false,
      points: 0,
      time_seconds: seconds,
    })
    navigate(-1)
  }

  async function checkAchievements({ hit, seconds, dist }: { hit: boolean; seconds: number; dist: number }) {
    if (!user || !worldId) return
    const toUnlock: string[] = []
    if (hit) toUnlock.push('first_find')
    if (hit && seconds < 5) toUnlock.push('eagle_eye')
    if (hit && seconds > 300) toUnlock.push('patient_finder')
    if (!hit && dist < 0.05) toUnlock.push('near_miss')

    for (const key of toUnlock) {
      const { error } = await supabase.rpc('unlock_achievement', { p_user_id: user.id, p_world_id: worldId, p_key: key })
      if (!error) {
        const achievement = ACHIEVEMENT_MAP[key]
        if (achievement) {
          const medal = achievement.tier === 'gold' ? '🥇' : achievement.tier === 'silver' ? '🥈' : '🥉'
          addToast(`${medal} ${achievement.name}! +${achievement.xp_reward} XP`, 'success', 5000)
        }
      }
    }
  }

  if (loading) return <LoadingScreen />
  if (!image) return <div className="p-8 text-center text-white/50">Bild nicht gefunden.</div>

  const showResult = revealed || practiceRevealed
  const resultHit = practiceRevealed ? practiceHit : attempt?.is_correct

  // Marker zusammenstellen
  const markers: ViewerMarker[] = []
  if (placing && tip) {
    markers.push({ x_rel: tip.x, y_rel: tip.y, variant: 'pin', color: '#818cf8' })
  }
  if (showResult && nat.w) {
    const shorter = Math.min(nat.w, nat.h)
    markers.push({
      x_rel: image.target_x,
      y_rel: image.target_y,
      radius_px: image.target_radius * shorter,
      variant: 'ring',
      color: resultHit ? '#22c55e' : '#eab308',
      pulse: true,
    })
    if (tip) {
      markers.push({ x_rel: tip.x, y_rel: tip.y, variant: 'pin', color: resultHit ? '#22c55e' : '#ef4444' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Bild-Viewport füllt 100dvh komplett aus */}
      <div className="absolute inset-0">
        <ImageMarkerViewer
          imageUrl={image.image_url}
          markers={markers}
          height="100%"
          interactive={placing && !submitting}
          onReady={(w, h) => setNat({ w, h })}
          onTap={(x, y) => { if (placing && !submitting) setTip({ x, y }) }}
        />
      </div>

      {/* Top-Leiste als Overlay: Zurück-Button + Timer-Badge */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-3 pb-3 safe-top bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <IconButton variant="grey" onClick={handleBack} aria-label="Zurück"><ChevronLeft size={22} strokeWidth={2.5} /></IconButton>
        {placing && !practice && (
          <span className="ml-auto bg-slate-200 text-slate-700 text-base font-mono font-extrabold px-4 py-2.5 rounded-2xl shadow-[0_3px_0_#94a3b8]">{elapsed}s</span>
        )}
        {placing && practice && (
          <span className="ml-auto bg-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">Übungsmodus</span>
        )}
        {revealed && attempt && (
          <span className={`ml-auto text-sm font-extrabold px-3.5 py-1.5 rounded-full text-white ${attempt.is_correct ? 'bg-green-500' : 'bg-red-500'}`}>
            {attempt.is_correct ? `✓ ${attempt.points} Pkt` : '✗ Daneben'}
          </span>
        )}
        {practiceRevealed && (
          <span className="ml-auto bg-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">Übungsmodus</span>
        )}
      </div>

      {placing && (
        <div className="absolute bottom-0 inset-x-0 z-30 px-4 pt-10 safe-area-pb bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          <div className="max-w-md mx-auto">
            <Button variant="success" size="lg" className="w-full" disabled={!tip || submitting} loading={submitting} onClick={confirmClick}>
              {!tip ? 'Tippe zuerst ins Bild' : (practice ? 'Prüfen' : '✓ Bestätigen')}
            </Button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur p-4 z-30 border-t border-white/10 safe-area-pb">
          <div className="text-center mb-3">
            {attempt?.is_correct ? (
              <p className="text-green-400 font-bold text-lg">🎉 Gefunden! +{attempt.points} Punkte</p>
            ) : (
              <p className="text-red-400 font-bold text-lg">💀 Daneben!</p>
            )}
          </div>
          <div className="flex gap-3">
            {isCampaign && (
              <Button variant="secondary" className="flex-1" onClick={enterPractice}>🔁 Üben</Button>
            )}
            <Button className="flex-1" onClick={() => navigate(-1)}>Zurück</Button>
          </div>
        </div>
      )}

      {practiceRevealed && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur p-4 z-30 border-t border-white/10 safe-area-pb">
          <div className="text-center mb-3">
            {practiceHit ? (
              <p className="text-green-400 font-bold text-lg">🎯 Getroffen!</p>
            ) : (
              <p className="text-red-400 font-bold text-lg">Daneben!</p>
            )}
            <p className="text-xs text-white/40 mt-1">Übungsmodus – keine Punkte</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={resetPractice}>Nochmal üben</Button>
            <Button className="flex-1" onClick={() => navigate(-1)}>Zurück</Button>
          </div>
        </div>
      )}

      {/* Abbruch-Dialog (Live-Event, Zurück vor dem Bestätigen) */}
      {showAbort && (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-6">
          <GameCard className="w-full max-w-sm">
            <p className="font-extrabold text-slate-800 text-lg mb-1">Wirklich abbrechen?</p>
            <p className="text-slate-600 text-sm mb-4">Dein Versuch gilt als verbraucht und du erhältst 0 Punkte.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAbort(false)}>Abbrechen</Button>
              <Button variant="danger" className="flex-1" loading={submitting} onClick={abortConfirm}>Bestätigen</Button>
            </div>
          </GameCard>
        </div>
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="h-full bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
