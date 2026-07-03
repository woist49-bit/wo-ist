import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Swords, Zap, Hourglass } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../stores/notifications'
import { calcPoints, isHit, distanceFraction, levelFromXp, effectiveElapsed } from '../lib/scoring'
import { getShopItem } from '../lib/shop'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'
import { ImageMarkerViewer, type ViewerMarker } from '../components/marker/ImageMarkerViewer'
import type { EventImage, PlayerAttempt } from '../types'

interface ActiveDebuff { debuff_type: string; stacks: number; sender_username: string }

export function ImageGamePage() {
  const { worldId, imageId, campaignId } = useParams<{ worldId: string; imageId: string; campaignId: string }>()
  const { user, refreshProfile } = useAuth()
  const { triggerAchievement, triggerLevelUp } = useNotifications()
  const navigate = useNavigate()
  const isCampaign = !!campaignId

  const [image, setImage] = useState<EventImage | null>(null)
  const [liveAttempt, setLiveAttempt] = useState<PlayerAttempt | null>(null) // Live-Versuch = Teilnahme/Ergebnis
  const [campaignFound, setCampaignFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [lastHit, setLastHit] = useState<boolean | null>(null)
  const [lastPoints, setLastPoints] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showAbort, setShowAbort] = useState(false)

  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)

  // Phase 5: aktive Effekte für diese Runde (nur Live-Event, frischer Versuch)
  const [armed, setArmed] = useState<Set<string>>(new Set())
  const [debuffs, setDebuffs] = useState<ActiveDebuff[]>([])
  const [begun, setBegun] = useState(true)   // Timer läuft erst, wenn die Runde wirklich startet
  const [blurred, setBlurred] = useState(false)

  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => { if (imageId && user) load() }, [imageId, user])

  async function load() {
    const [imgRes, attRes] = await Promise.all([
      supabase.from('event_images').select('*').eq('id', imageId).single(),
      supabase.from('player_attempts').select('*').eq('image_id', imageId).eq('user_id', user!.id).maybeSingle(),
    ])
    setImage(imgRes.data)
    setLiveAttempt(attRes.data)

    if (isCampaign) {
      const { data: prog } = await supabase.from('campaign_progress')
        .select('found').eq('campaign_id', campaignId).eq('image_id', imageId).eq('user_id', user!.id).maybeSingle()
      setCampaignFound(prog?.found ?? false)
      // Kampagne startet immer spielbar (auch bereits gefundene Bilder -> wiederholbar)
    } else if (attRes.data) {
      // Live-Event: vorhandener Versuch -> Ergebnis zeigen
      setTip({ x: attRes.data.click_x, y: attRes.data.click_y })
      setLastHit(attRes.data.is_correct)
      setLastPoints(attRes.data.points)
      setRevealed(true)
    }

    // Aktive Items/Debuffs nur für einen frischen Live-Versuch laden
    let hasDebuffs = false
    if (!isCampaign && !attRes.data) {
      const [armedRes, debuffRes] = await Promise.all([
        supabase.from('player_image_items').select('item_key').eq('image_id', imageId),
        supabase.rpc('my_image_debuffs', { p_image_id: imageId }),
      ])
      setArmed(new Set((armedRes.data ?? []).map(r => r.item_key)))
      const list = (debuffRes.data ?? []) as ActiveDebuff[]
      setDebuffs(list)
      hasDebuffs = list.length > 0
    }

    // Bei Debuffs erst nach dem Sabotage-Hinweis starten, sonst sofort
    setBegun(!hasDebuffs)
    startTimeRef.current = Date.now()
    setLoading(false)
  }

  const placing = !revealed

  const timerStacks = useMemo(() => debuffs.filter(d => d.debuff_type === 'timer_debuff').reduce((s, d) => s + d.stacks, 0), [debuffs])
  const blurStacks = useMemo(() => debuffs.filter(d => d.debuff_type === 'blur_debuff').reduce((s, d) => s + d.stacks, 0), [debuffs])
  const hasZeitlupe = armed.has('slow_motion')
  const hasDouble = armed.has('double_points')
  const hasDebuffs = timerStacks + blurStacks > 0

  // Unschärfe-Fenster: pro Stapel drei ~1s-Flacker (bei 2s/5s/8s) im jeweiligen 10s-Block (echte Zeit)
  const blurIntervals = useMemo(() => {
    const arr: [number, number][] = []
    for (let w = 0; w < blurStacks; w++) for (const s of [2, 5, 8]) arr.push([w * 10 + s, w * 10 + s + 1])
    return arr
  }, [blurStacks])

  useEffect(() => {
    if (!placing || !begun) return
    const interval = setInterval(() => {
      const real = (Date.now() - startTimeRef.current) / 1000
      setElapsed(Math.round(effectiveElapsed(real, timerStacks, hasZeitlupe)))
      if (blurStacks > 0) setBlurred(blurIntervals.some(([a, b]) => real >= a && real < b))
    }, 100)
    return () => clearInterval(interval)
  }, [placing, begun, timerStacks, hasZeitlupe, blurStacks, blurIntervals])

  function startRound() {
    startTimeRef.current = Date.now()
    setElapsed(0)
    setBegun(true)
  }

  async function confirmClick() {
    if (!tip || !image || !user || !nat.w) return
    const real = (Date.now() - startTimeRef.current) / 1000
    const seconds = Math.round(effectiveElapsed(real, timerStacks, hasZeitlupe)) // Timer-Debuff/Zeitlupe verzerren die Zeit
    const hit = isHit(tip.x, tip.y, image.target_x, image.target_y, image.target_radius, nat.w, nat.h)
    const dist = distanceFraction(tip.x, tip.y, image.target_x, image.target_y)
    setSubmitting(true)

    if (isCampaign) {
      let awarded = 0
      if (hit && !campaignFound) {
        const eligible = !liveAttempt // kein Live-Versuch auf diesem Bild -> Punkte (Legacy oder neuer Spieler)
        awarded = eligible ? calcPoints(seconds) : 0
        await supabase.from('campaign_progress').upsert({
          campaign_id: campaignId, image_id: image.id, user_id: user.id,
          world_id: worldId, found: true, points: awarded,
        }, { onConflict: 'campaign_id,image_id,user_id' })
        setCampaignFound(true)
        // Immer aufrufen (auch bei 0 Punkten), damit die Kampagnen-Abschluss-Gems geprüft werden
        await awardAndNotify(awarded, seconds, dist, true)
      }
      setLastHit(hit); setLastPoints(awarded); setRevealed(true); setSubmitting(false)
      return
    }

    // Live-Event: genau ein Versuch. Doppelte-Punkte-Buff verdoppelt bei Fund.
    let points = hit ? calcPoints(seconds) : 0
    if (hit && hasDouble) points *= 2
    const { data } = await supabase.from('player_attempts').insert({
      image_id: image.id, user_id: user.id, click_x: tip.x, click_y: tip.y,
      is_correct: hit, points, time_seconds: seconds,
    }).select().single()
    if (data) {
      setLiveAttempt(data)
      if (hit) {
        await awardAndNotify(points, seconds, dist, true)
      }
    }
    setLastHit(hit); setLastPoints(points); setRevealed(true); setSubmitting(false)
  }

  function playAgain() {
    setRevealed(false); setTip(null); setLastHit(null); setLastPoints(0)
    startTimeRef.current = Date.now()
  }

  // Live-Event: Zurück vor dem Bestätigen -> Abbruch-Dialog. Kampagne / aufgelöst: direkt zurück.
  function handleBack() {
    if (!isCampaign && placing) setShowAbort(true)
    else navigate(-1)
  }

  async function abortConfirm() {
    if (!image || !user) { navigate(-1); return }
    setSubmitting(true)
    const seconds = Math.round(effectiveElapsed((Date.now() - startTimeRef.current) / 1000, timerStacks, hasZeitlupe))
    await supabase.from('player_attempts').insert({
      image_id: image.id, user_id: user.id, click_x: tip?.x ?? 0, click_y: tip?.y ?? 0,
      is_correct: false, points: 0, time_seconds: seconds,
    })
    navigate(-1)
  }

  // Vergibt XP + schaltet Achievements frei und löst die Benachrichtigungen aus
  // (Banner pro neu freigeschaltetem Achievement, Level-Up-Overlay falls Level gestiegen).
  async function awardAndNotify(pointsToAdd: number, seconds: number, dist: number, hit: boolean) {
    if (!user || !worldId) return
    const { data: before } = await supabase.from('profiles').select('global_xp').eq('id', user.id).single()
    const oldXp = before?.global_xp ?? 0

    if (pointsToAdd > 0) {
      await supabase.rpc('add_xp', { p_user_id: user.id, p_xp: pointsToAdd, p_world_id: worldId })
    }

    const toUnlock: string[] = []
    if (hit) toUnlock.push('first_find')
    if (hit && seconds < 5) toUnlock.push('eagle_eye')
    if (hit && seconds > 300) toUnlock.push('patient_finder')
    if (!hit && dist < 0.05) toUnlock.push('near_miss')
    for (const key of toUnlock) {
      const { data: isNew } = await supabase.rpc('unlock_achievement', { p_user_id: user.id, p_world_id: worldId, p_key: key })
      if (isNew) triggerAchievement(key)
    }

    // Gems serverseitig + idempotent: Live-Fund (5) bzw. komplett abgeschlossene Kampagne (20)
    if (image) {
      if (isCampaign && campaignId) {
        await supabase.rpc('award_campaign_gems', { p_user_id: user.id, p_campaign_id: campaignId })
      } else if (hit) {
        await supabase.rpc('award_find_gems', { p_user_id: user.id, p_image_id: image.id })
      }
    }

    const { data: after } = await supabase.from('profiles').select('global_xp').eq('id', user.id).single()
    const newXp = after?.global_xp ?? oldXp
    const oldLevel = levelFromXp(oldXp).level
    const nl = levelFromXp(newXp)
    if (nl.level > oldLevel) triggerLevelUp(nl.level, nl.xpNeeded - nl.xpIntoLevel)

    refreshProfile() // Header: Gems (und ggf. Level) live aktualisieren
  }

  if (loading) return <LoadingScreen />
  if (!image) return <div className="p-8 text-center text-white/50">Bild nicht gefunden.</div>

  const markers: ViewerMarker[] = []
  if (placing && tip) markers.push({ x_rel: tip.x, y_rel: tip.y, variant: 'pin', color: '#818cf8' })
  if (revealed && nat.w) {
    const shorter = Math.min(nat.w, nat.h)
    markers.push({ x_rel: image.target_x, y_rel: image.target_y, radius_px: image.target_radius * shorter, variant: 'ring', color: lastHit ? '#22c55e' : '#eab308', pulse: true })
    if (tip) markers.push({ x_rel: tip.x, y_rel: tip.y, variant: 'pin', color: lastHit ? '#22c55e' : '#ef4444' })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div
        className="absolute inset-0"
        style={{ filter: blurred ? 'blur(16px)' : 'none', transition: 'filter 0.12s linear' }}
      >
        <ImageMarkerViewer
          imageUrl={image.image_url}
          markers={markers}
          height="100%"
          interactive={placing && !submitting}
          onReady={(w, h) => setNat({ w, h })}
          onTap={(x, y) => { if (placing && !submitting) setTip({ x, y }) }}
        />
      </div>

      {/* Sabotage-Hinweis vor dem Start (Debuffs liegen auf diesem Bild) */}
      {placing && !begun && hasDebuffs && (
        <SabotageScreen debuffs={debuffs} onStart={startRound} onBack={() => navigate(-1)} />
      )}

      {/* Aktive Effekte während des Spielens */}
      {placing && begun && (hasDouble || hasZeitlupe || timerStacks > 0 || blurStacks > 0) && (
        <div className="absolute top-16 inset-x-0 z-20 flex justify-center gap-1.5 px-3 pointer-events-none">
          {hasDouble && <EffectPill color="bg-green-500" icon={<Zap size={13} strokeWidth={2.5} />} label="2×" />}
          {hasZeitlupe && <EffectPill color="bg-green-500" icon={<Hourglass size={13} strokeWidth={2.5} />} label="Zeitlupe" />}
          {timerStacks > 0 && <EffectPill color="bg-red-500" icon={<Swords size={13} strokeWidth={2.5} />} label={`Timer ×${timerStacks}`} />}
          {blurStacks > 0 && <EffectPill color="bg-red-500" icon={<Swords size={13} strokeWidth={2.5} />} label={`Unschärfe ×${blurStacks}`} />}
        </div>
      )}

      {/* Top-Leiste: Zurück + Timer-Badge */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-3 pb-3 safe-top bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <IconButton variant="grey" onClick={handleBack} aria-label="Zurück"><ChevronLeft size={22} strokeWidth={2.5} /></IconButton>
        {placing && (
          <span className="ml-auto bg-slate-200 text-slate-700 text-base font-mono font-extrabold px-4 py-2.5 rounded-2xl shadow-[0_3px_0_#94a3b8]">{elapsed}s</span>
        )}
        {revealed && (
          <span className={`ml-auto text-sm font-extrabold px-3.5 py-1.5 rounded-full text-white ${lastHit ? 'bg-green-500' : 'bg-red-500'}`}>
            {lastHit ? (lastPoints > 0 ? `✓ ${lastPoints} Pkt` : '✓ Gefunden') : '✗ Daneben'}
          </span>
        )}
      </div>

      {placing && (
        <div className="absolute bottom-0 inset-x-0 z-30 px-4 pt-10 safe-area-pb bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          <div className="max-w-md mx-auto">
            <Button variant="success" size="lg" className="w-full" disabled={!tip || submitting} loading={submitting} onClick={confirmClick}>
              {!tip ? 'Tippe zuerst ins Bild' : '✓ Bestätigen'}
            </Button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur p-4 z-30 border-t border-white/10 safe-area-pb">
          <div className="text-center mb-3">
            {lastHit ? (
              <p className="text-green-400 font-bold text-lg">🎉 Gefunden!{lastPoints > 0 ? ` +${lastPoints} Punkte` : ''}</p>
            ) : (
              <p className="text-red-400 font-bold text-lg">💀 Daneben!</p>
            )}
            {isCampaign && lastHit && lastPoints === 0 && (
              <p className="text-xs text-white/40 mt-1">Bereits gespielt – keine zusätzlichen Punkte</p>
            )}
          </div>
          <div className="flex gap-3">
            {isCampaign && (
              <Button variant="secondary" className="flex-1" onClick={playAgain}>🔁 Nochmal</Button>
            )}
            <Button className="flex-1" onClick={() => navigate(-1)}>Zurück</Button>
          </div>
        </div>
      )}

      {/* Abbruch-Dialog (nur Live-Event, Zurück vor dem Bestätigen) */}
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

function EffectPill({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${color} text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-[0_2px_0_#0000002e]`}>
      {icon}{label}
    </span>
  )
}

// Warnscreen vor dem Bild, wenn Debuffs darauf warten ("Du wurdest sabotiert!")
function SabotageScreen({ debuffs, onStart, onBack }: { debuffs: ActiveDebuff[]; onStart: () => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center p-6 safe-top safe-area-pb">
      <div className="w-full max-w-sm bg-slate-900 border-[3px] border-red-500 rounded-3xl p-6 text-center shadow-[0_0_40px_#ef444455] animate-pop-in">
        <div className="w-16 h-16 rounded-2xl bg-red-500 text-white flex items-center justify-center mx-auto mb-3 shadow-[0_4px_0_#b91c1c]">
          <Swords size={32} strokeWidth={2.5} />
        </div>
        <p className="text-2xl font-extrabold text-red-400 mb-1">Du wurdest sabotiert!</p>
        <p className="text-sm text-white/50 mb-4">Diese Debuffs liegen auf diesem Bild:</p>
        <div className="flex flex-col gap-2 mb-6 text-left">
          {debuffs.map((d, i) => {
            const it = getShopItem(d.debuff_type)
            const Icon = it?.icon ?? Swords
            return (
              <div key={i} className="flex items-center gap-2.5 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2">
                <Icon size={18} strokeWidth={2.5} className="text-red-400 flex-shrink-0" />
                <span className="font-bold text-white text-sm flex-1">{it?.name ?? d.debuff_type}{d.stacks > 1 ? ` ×${d.stacks}` : ''}</span>
                <span className="text-[11px] text-red-300 font-semibold">von {d.sender_username}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onBack}>Zurück</Button>
          <Button variant="danger" className="flex-1" onClick={onStart}>Trotzdem spielen</Button>
        </div>
      </div>
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
