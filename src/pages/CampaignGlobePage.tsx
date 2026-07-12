import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import type { Campaign } from '../types'

const EARTH_TEX = '/textures/earth-day.jpg'

interface Pin { campaign: Campaign; lat: number; lng: number; total: number; done: number }
interface Cluster { lat: number; lng: number; items: Pin[] }

// ============================================================================
// CLUSTER-RADIUS – hier justieren, wie früh nahe Pins zusammengefasst werden.
// Der Cluster-Radius (in Grad) skaliert mit der Zoom-Höhe:
//     radius = Zoomhöhe * CLUSTER_RADIUS_DEG_PER_ALTITUDE   (begrenzt auf [MIN, MAX])
// Zwei Pins verschmelzen erst, wenn ihr Abstand kleiner als dieser Radius ist.
// KLEINER = Pins bleiben länger einzeln sichtbar (weniger Clustering).
// (Bewusst deutlich kleiner gesetzt als zuvor – vorher lag der Wert bei Start-Zoom ~40°.)
const CLUSTER_RADIUS_DEG_PER_ALTITUDE = 3.5
const CLUSTER_MIN_DEG = 0.4   // näher zusammen als das = immer clustern (echte Überlappung)
const CLUSTER_MAX_DEG = 16    // Deckel beim ganz weiten Herauszoomen
// ============================================================================

// Konkreter Radius bei aktueller Zoom-Höhe, auf 0.5°-Stufen quantisiert -> Cluster werden
// nur an wenigen Zoom-Schwellen neu berechnet (kein Flackern bei jeder Zoom-Bewegung).
function radiusFromAltitude(alt: number): number {
  const clamped = Math.min(CLUSTER_MAX_DEG, Math.max(CLUSTER_MIN_DEG, alt * CLUSTER_RADIUS_DEG_PER_ALTITUDE))
  return Math.round(clamped * 2) / 2
}

// Echtes radiusbasiertes Clustering (greedy): ein Pin kommt zu einem Cluster, wenn er näher
// als radiusDeg an dessen Schwerpunkt liegt. Längengrad-Abstand mit cos(Breite) gewichtet,
// da Längengrade Richtung Pol schrumpfen. n ist klein (wenige Kampagnen) -> O(n²) unkritisch.
function clusterPins(pins: Pin[], radiusDeg: number): Cluster[] {
  const clusters: Cluster[] = []
  for (const p of pins) {
    let target: Cluster | null = null
    for (const c of clusters) {
      const dLat = c.lat - p.lat
      let dLng = c.lng - p.lng
      if (dLng > 180) dLng -= 360
      else if (dLng < -180) dLng += 360
      dLng *= Math.cos((p.lat * Math.PI) / 180)
      if (Math.hypot(dLat, dLng) <= radiusDeg) { target = c; break }
    }
    if (target) {
      target.items.push(p)
      target.lat = target.items.reduce((s, q) => s + q.lat, 0) / target.items.length
      target.lng = target.items.reduce((s, q) => s + q.lng, 0) / target.items.length
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, items: [p] })
    }
  }
  return clusters
}

// Statische (nicht animierte) Marker-DOM-Knoten – begrenzt gleichzeitige Animationen bewusst.
function pinSvg(): string {
  return `<svg width="26" height="26" viewBox="0 0 24 24" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))"><path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.3" fill="#ffffff" stroke="none"/></svg>`
}
function clusterBadge(n: number): string {
  return `<div style="width:28px;height:28px;border-radius:9999px;background:#7c3aed;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.55)">${n}</div>`
}

// ============================================================================
// DEKORATIVE EFFEKTE (rein optisch, nicht anklickbar, keine Funktion).
// Bei Ruckeln auf Mobile in dieser Reihenfolge reduzieren: 1) SATELLITES kürzen (max 2),
// 2) LIGHTNING_MIN/MAX erhöhen. Wolken zuletzt anfassen.
// Wolken: 6–10 Cluster aus je 3–5 überlappenden weißen Low-Poly-Kugeln (Cartoon-Puschel),
// in wenigen Regionen geballt (große Lücken dazwischen), je eigener Drift um die Erdachse.
const CLOUD_OPACITY = 0.9
const CLOUD_ALTITUDE = 0.03        // Schwebehöhe über der Oberfläche (Anteil des Erdradius)
const CLOUD_PUFF_SEGMENTS = 8      // sehr niedrig aufgelöste Kugeln (Performance)
const CLOUD_REGIONS = [            // Ballungszentren; dazwischen bleibt es wolkenfrei
  { lat: 28, lng: -55 },
  { lat: -12, lng: 130 },
  { lat: 48, lng: 25 },
]
const CLOUD_CLUSTERS_PER_REGION = 3   // -> ~9 Cluster
const CLOUD_DRIFT_MIN = 0.03           // rad/s – bewusst nicht zu langsam
const CLOUD_DRIFT_MAX = 0.055
// Satelliten: eigene Umlaufbahn (Radius als Vielfaches des Globusradius), Neigung und
// Geschwindigkeit je Satellit unterschiedlich, damit es nicht synchron wirkt.
const SATELLITES = [
  { orbit: 1.28, tiltX: 0.35, tiltZ: 0.20, speed: 0.28, color: 0xffffff, size: 0.9 },
  { orbit: 1.46, tiltX: -0.9, tiltZ: 0.55, speed: -0.19, color: 0x93c5fd, size: 1.1 },
  { orbit: 1.64, tiltX: 1.15, tiltZ: -0.4, speed: 0.14, color: 0xfcd34d, size: 0.8 },
]
const LIGHTNING_MIN_MS = 5000
const LIGHTNING_MAX_MS = 15000
const LIGHTNING_DURATION_MS = 450
// ============================================================================

// Weicher Leuchtpunkt (Blitz) via Canvas – additive Sprite-Textur.
function makeGlowTexture(): THREE.Texture {
  const s = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(191,222,255,0.65)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(cv)
}

export function CampaignGlobePage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const wrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const altitudeRef = useRef(2.4)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [clusterRadius, setClusterRadius] = useState(() => radiusFromAltitude(2.4))
  const [selected, setSelected] = useState<Pin | null>(null)

  // Container ausmessen (Globus braucht feste Pixelmaße), auf Resize aktualisieren.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Kampagnen mit Standort + Fortschritt laden (gleiche Logik wie Startseite).
  useEffect(() => {
    if (!worldId || !user) return
    let active = true
    ;(async () => {
      const [campRes, imgRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('world_id', worldId),
        supabase.from('event_images').select('id, event_id, campaign_id').eq('world_id', worldId),
      ])
      const camps = ((campRes.data ?? []) as Campaign[]).filter(c => c.latitude != null && c.longitude != null)
      const images = (imgRes.data ?? []) as { id: string; event_id: string | null; campaign_id: string | null }[]
      const ids = images.map(i => i.id)

      const completed = new Set<string>()
      if (ids.length) {
        const [attRes, progRes] = await Promise.all([
          supabase.from('player_attempts').select('image_id, is_correct').eq('user_id', user.id).in('image_id', ids),
          supabase.from('campaign_progress').select('image_id, found').eq('user_id', user.id).in('image_id', ids),
        ])
        for (const a of attRes.data ?? []) if (a.is_correct) completed.add(a.image_id)
        for (const p of progRes.data ?? []) if (p.found) completed.add(p.image_id)
      }

      const built: Pin[] = camps.map(c => {
        const imgs = images.filter(i => c.original_event_id ? i.event_id === c.original_event_id : i.campaign_id === c.id)
        return { campaign: c, lat: c.latitude!, lng: c.longitude!, total: imgs.length, done: imgs.filter(i => completed.has(i.id)).length }
      })
      if (!active) return
      setPins(built)
      setLoading(false)
    })()
    return () => { active = false }
  }, [worldId, user])

  // Steuerung konfigurieren: kein Auto-Rotate, sanftes Damping, Pixel-Ratio gedeckelt (Mobile-Perf).
  useEffect(() => {
    const g = globeRef.current
    if (!g || !ready) return
    const c = g.controls() as any
    c.autoRotate = false
    c.enablePan = false
    c.enableDamping = true
    c.dampingFactor = 0.12
    c.rotateSpeed = 0.6
    c.zoomSpeed = 0.8
    try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)) } catch {}
    // Startansicht auf den Schwerpunkt der Pins (oder neutral), leicht herausgezoomt.
    const start = pins.length
      ? { lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length, lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length, altitude: 2.4 }
      : { lat: 25, lng: 0, altitude: 2.4 }
    g.pointOfView(start, 0)
  }, [ready, pins])

  // Dekorative Effekte (Wolken-Drift, kreisende Satelliten, gelegentliche Blitze) als reine
  // three.js-Objekte in der Szene – nicht anklickbar, eine gemeinsame rAF-Schleife. Läuft einmal
  // bei „ready" und räumt bei Unmount alles restlos auf (Geometrien/Materialien/Texturen).
  useEffect(() => {
    const g = globeRef.current as any
    if (!g || !ready) return
    const scene: THREE.Scene = g.scene()
    const R: number = g.getGlobeRadius()
    const added: THREE.Object3D[] = []
    const disposables: Array<{ dispose: () => void }> = []

    // --- Wolken: Cluster aus Low-Poly-Kugeln, je auf eigenem Pivot um die Erdachse driftend ---
    // Geometrie + Material werden von ALLEN Puffs geteilt (nur Transform pro Kugel) -> sehr leicht.
    const puffGeo = new THREE.SphereGeometry(1, CLOUD_PUFF_SEGMENTS, CLOUD_PUFF_SEGMENTS - 2)
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: CLOUD_OPACITY, depthWrite: false })
    disposables.push(puffGeo, puffMat)
    const cloudPivots: Array<{ pivot: THREE.Object3D; speed: number }> = []
    for (const region of CLOUD_REGIONS) {
      for (let k = 0; k < CLOUD_CLUSTERS_PER_REGION; k++) {
        const lat = region.lat + (Math.random() - 0.5) * 30
        const lng = region.lng + (Math.random() - 0.5) * 40
        const pivot = new THREE.Group() // im Ursprung -> Rotation.y dreht den Cluster um die Erdachse
        const clump = new THREE.Group()
        const pos = g.getCoords(lat, lng, CLOUD_ALTITUDE)
        clump.position.set(pos.x, pos.y, pos.z)
        clump.lookAt(0, 0, 0) // lokale Z-Achse zeigt radial -> Puffs liegen flach tangential zur Oberfläche
        const base = R * (0.05 + Math.random() * 0.03)
        const n = 3 + Math.floor(Math.random() * 3) // 3–5 Kugeln
        for (let i = 0; i < n; i++) {
          const puff = new THREE.Mesh(puffGeo, puffMat)
          puff.scale.setScalar(base * (0.6 + Math.random() * 0.7))
          puff.position.set(
            (Math.random() - 0.5) * base * 2.4, // breit (tangential)
            (Math.random() - 0.5) * base * 1.0, // mittel (tangential)
            (Math.random() - 0.5) * base * 0.5, // flach (radial)
          )
          clump.add(puff)
        }
        pivot.add(clump)
        scene.add(pivot); added.push(pivot)
        cloudPivots.push({ pivot, speed: CLOUD_DRIFT_MIN + Math.random() * (CLOUD_DRIFT_MAX - CLOUD_DRIFT_MIN) })
      }
    }

    // --- Satelliten: je eigener geneigter Orbit + Tempo ---
    const orbits = SATELLITES.map(cfg => {
      const pivot = new THREE.Group()
      pivot.rotation.set(cfg.tiltX, 0, cfg.tiltZ)
      const orbit = new THREE.Group()
      orbit.rotation.y = Math.random() * Math.PI * 2 // zufällige Startphase
      const bodyGeo = new THREE.SphereGeometry(R * 0.01 * cfg.size, 8, 8)
      const bodyMat = new THREE.MeshBasicMaterial({ color: cfg.color })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.set(R * cfg.orbit, 0, 0)
      orbit.add(body); pivot.add(orbit); scene.add(pivot)
      added.push(pivot); disposables.push(bodyGeo, bodyMat)
      return { orbit, speed: cfg.speed }
    })

    // --- Blitze: ein additives Sprite, wird zufällig positioniert und kurz aufgeblendet ---
    const glowTex = makeGlowTexture()
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    const flash = new THREE.Sprite(glowMat)
    flash.scale.setScalar(R * 0.16)
    flash.visible = false
    scene.add(flash); added.push(flash); disposables.push(glowTex, glowMat)

    let flashStart = 0
    let flashTimer = 0
    const scheduleFlash = () => {
      flashTimer = window.setTimeout(() => {
        const lat = Math.random() * 180 - 90
        const lng = Math.random() * 360 - 180
        const p = g.getCoords(lat, lng, 0.02)
        flash.position.set(p.x, p.y, p.z)
        flash.visible = true
        flashStart = performance.now()
        scheduleFlash()
      }, LIGHTNING_MIN_MS + Math.random() * (LIGHTNING_MAX_MS - LIGHTNING_MIN_MS))
    }
    scheduleFlash()

    // --- Eine gemeinsame Animationsschleife für alle drei Effekte ---
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      for (const c of cloudPivots) c.pivot.rotation.y += c.speed * dt
      for (const o of orbits) o.orbit.rotation.y += o.speed * dt
      if (flash.visible) {
        const t = (now - flashStart) / LIGHTNING_DURATION_MS
        if (t >= 1) { flash.visible = false; glowMat.opacity = 0 }
        else { const env = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8; glowMat.opacity = Math.max(0, env) * 0.9 }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(flashTimer)
      for (const o of added) scene.remove(o)
      for (const d of disposables) d.dispose()
    }
  }, [ready])

  const clusters = useMemo(() => clusterPins(pins, clusterRadius), [pins, clusterRadius])

  const handleZoom = useCallback((pov: { altitude: number }) => {
    altitudeRef.current = pov.altitude
    const next = radiusFromAltitude(pov.altitude)
    setClusterRadius(prev => (prev === next ? prev : next))
  }, [])

  const buildElement = useCallback((d: object) => {
    const c = d as Cluster
    const el = document.createElement('div')
    el.style.pointerEvents = 'auto'
    el.style.cursor = 'pointer'
    if (c.items.length === 1) {
      el.innerHTML = pinSvg()
      el.onclick = () => setSelected(c.items[0])
    } else {
      el.innerHTML = clusterBadge(c.items.length)
      el.onclick = () => globeRef.current?.pointOfView(
        { lat: c.lat, lng: c.lng, altitude: Math.max(0.4, altitudeRef.current * 0.45) }, 700,
      )
    }
    return el
  }, [])

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={EARTH_TEX}
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.14}
          onGlobeReady={() => setReady(true)}
          onZoom={handleZoom}
          htmlElementsData={clusters}
          htmlElement={buildElement}
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-4 border-white/70 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && pins.length === 0 && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-6 pointer-events-none">
          <div className="bg-black/45 text-white/90 text-sm font-semibold rounded-full px-4 py-2 backdrop-blur">
            Noch keine Kampagnen auf dem Globus
          </div>
        </div>
      )}

      {selected && (
        <div className="absolute inset-0 z-20 flex items-end justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-[#fdf6e3] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.4)] animate-slide-in-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{selected.campaign.title}</h3>
              <button onClick={() => setSelected(null)} aria-label="Schließen" className="text-slate-400 -mt-1 -mr-1 p-1">
                <X size={22} strokeWidth={2.5} />
              </button>
            </div>
            <p className="text-sm text-slate-500 font-semibold mt-0.5">
              {selected.total} {selected.total === 1 ? 'Bild' : 'Bilder'} · {selected.done} gefunden
            </p>

            {selected.total > 0 && (
              <div className="flex flex-wrap gap-1.5 my-3">
                {Array.from({ length: selected.total }).map((_, i) => (
                  <span key={i} className={`w-3 h-3 rounded-full ${i < selected.done ? 'bg-green-500 shadow-[inset_0_1px_0_#ffffff80]' : 'bg-slate-300'}`} />
                ))}
              </div>
            )}

            <Button variant="success" size="lg" className="w-full mt-2" onClick={() => navigate(`/world/${worldId}/campaign/${selected.campaign.id}`)}>
              Kampagne öffnen
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
