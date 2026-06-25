import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../stores/toast'
import { calcPoints, isHit, distanceFraction } from '../lib/scoring'
import { ACHIEVEMENT_MAP } from '../lib/achievements'
import { Button } from '../components/ui/Button'
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

      {/* Top-Leiste als Overlay */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-4 pb-3 safe-top bg-gradient-to-b from-black/80 via-black/50 to-transparent">
        <button onClick={() => navigate(-1)} className="text-white/70 text-sm">← Zurück</button>
        {placing && (
          <>
            <span className="text-white/40 text-xs">
              {practice ? 'Übungsmodus – keine Punkte' : 'Tippe auf das Bild um Paul zu markieren'}
            </span>
            {!practice && <span className="ml-auto text-white/70 text-sm font-mono font-bold">{String(elapsed).padStart(2, '0')}s</span>}
          </>
        )}
        {revealed && attempt && (
          <div className={`ml-auto text-sm font-bold ${attempt.is_correct ? 'text-green-400' : 'text-red-400'}`}>
            {attempt.is_correct ? `✓ ${attempt.points} Punkte (${attempt.time_seconds}s)` : '✗ Daneben!'}
          </div>
        )}
        {practiceRevealed && <div className="ml-auto text-sm font-bold text-white/60">Übungsmodus</div>}
      </div>

      {placing && tip && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur p-4 z-30 border-t border-white/10 safe-area-pb">
          <p className="text-center text-white/70 text-sm mb-3">
            {practice ? 'Übungsmodus – wird nicht gespeichert.' : 'Bist du sicher? Du hast nur einen Versuch!'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setTip(null)}>
              Neu setzen
            </Button>
            <Button className="flex-1" loading={submitting} onClick={confirmClick}>
              {practice ? 'Prüfen' : '✓ Bestätigen'}
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
