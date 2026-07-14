import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import type { Campaign } from '../types'

// ============================================================================
// LOW-POLY-3D-MODELL (ersetzt die Textur-Kugel). Lokal geladen (offline), Materialien
// auf Metallic-Roughness konvertiert + Meshopt-komprimiert (siehe public/models/).
const EARTH_MODEL = '/models/low-poly_earth.glb'
// Rotations-Offset, um das Modell auf die react-globe.gl-Koordinaten auszurichten.
// Per Referenzpunkt-Test verifiziert (Deutschland/NY/Sydney passen exakt): Y −90°.
const MODEL_ROTATION_DEG = { x: 0, y: -90, z: 0 }
// ============================================================================

interface Pin { campaign: Campaign; lat: number; lng: number; total: number; done: number }

// ============================================================================
// KAMPAGNEN-PINS – klassische Stecknadel: kugeliger, farbiger Kopf + dünner,
// grau-metallischer Stachel, der zur exakten Koordinate auf der Oberfläche zeigt.
// Kopf-Farbe NUTZERSPEZIFISCH nach Fortschritt (rot = nicht begonnen, orange = begonnen,
// grün = abgeschlossen). Gilt genauso für archivierte Live-Events (in der DB ebenfalls
// Kampagnen). Fortschritt (done/total) = dieselbe Quelle wie die Dot-Anzeige im Menü.
const R_GLOBE = 100                      // three-globe-Radius (konstant) – Basis der Pin-Maße
const PIN_HEAD_RADIUS = R_GLOBE * 0.024
const PIN_SPIKE_LEN = R_GLOBE * 0.075    // Stachel-Länge (Oberfläche -> Kopf)
const PIN_SPIKE_TIP_DIG = R_GLOBE * 0.02 // Spitze etwas unter der Oberfläche (steckt sichtbar „drin")
const PIN_SPIKE_RADIUS = R_GLOBE * 0.008
const PIN_UP = new THREE.Vector3(0, 1, 0)

type PinStatus = 'red' | 'orange' | 'green'

// Geteilte Geometrien + Materialien (ein Satz für alle Nadeln) -> sehr leicht.
const pinHeadGeo = new THREE.SphereGeometry(PIN_HEAD_RADIUS, 16, 12)
const pinSpikeGeo = new THREE.ConeGeometry(PIN_SPIKE_RADIUS, PIN_SPIKE_LEN + PIN_SPIKE_TIP_DIG, 10)
const pinSpikeMat = new THREE.MeshStandardMaterial({ color: 0x9aa3af, roughness: 0.3, metalness: 0.9 }) // grau, metallisch
const pinHeadMats: Record<PinStatus, THREE.MeshStandardMaterial> = {
  red:    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35, metalness: 0.1 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.1 }),
  green:  new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.35, metalness: 0.1 }),
}

function pinStatus(p: Pin): PinStatus {
  if (p.total > 0 && p.done >= p.total) return 'green' // alle Bilder gefunden
  if (p.done > 0) return 'orange'                       // begonnen, nicht abgeschlossen
  return 'red'                                          // noch kein Bild gefunden
}

// Baut eine Stecknadel. Lokal: +Y = radial nach außen; der Gruppen-Ursprung sitzt auf der
// Oberfläche (Positionierung/Ausrichtung erfolgt in positionPin über getCoords).
function buildPushpin(p: Pin): THREE.Group {
  const g = new THREE.Group()
  const spike = new THREE.Mesh(pinSpikeGeo, pinSpikeMat)
  spike.rotation.x = Math.PI                                 // Spitze nach unten (in die Oberfläche)
  spike.position.y = (PIN_SPIKE_LEN - PIN_SPIKE_TIP_DIG) / 2 // Spitze bei y≈-dig, Basis bei y=SPIKE_LEN
  const head = new THREE.Mesh(pinHeadGeo, pinHeadMats[pinStatus(p)])
  head.position.y = PIN_SPIKE_LEN + PIN_HEAD_RADIUS * 0.85   // Kopf sitzt oben auf dem Stachel
  g.add(spike, head)
  return g
}
// ============================================================================

// ============================================================================
// DEKORATIVE EFFEKTE (rein optisch, nicht anklickbar). Wolken: Cluster aus Low-Poly-Kugeln,
// je auf eigenem Pivot um die Erdachse driftend. Gelegentliche Blitze.
const CLOUD_OPACITY = 0.9
const CLOUD_ALTITUDE = 0.03
const CLOUD_PUFF_SEGMENTS = 8
const CLOUD_REGIONS = [
  { lat: 28, lng: -55 },
  { lat: -12, lng: 130 },
  { lat: 48, lng: 25 },
]
const CLOUD_CLUSTERS_PER_REGION = 10
const CLOUD_DRIFT_MIN = 0.03
const CLOUD_DRIFT_MAX = 0.055
const LIGHTNING_MIN_MS = 5000
const LIGHTNING_MAX_MS = 15000
const LIGHTNING_DURATION_MS = 450
// ============================================================================

// ============================================================================
// EINFLUG-ANIMATION beim ersten Öffnen (kamerabasiert -> Modell, Wolken, Pins fliegen
// gemeinsam herein; three-globes eigenes animateIn ist abgeschaltet).
const FLY_IN_MS = 1700
const FLY_IN_START_ALTITUDE = 5.0
const FLY_IN_END_ALTITUDE = 2.4
const FLY_IN_FROM = { lat: 20, lng: 0 }
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
  const flewInRef = useRef(false)    // Einflug nur einmal ausführen
  const flyingInRef = useRef(false)  // während des Einflugs Pin-Klicks ignorieren

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
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

  // Kampagnen mit Standort + nutzerspezifischem Fortschritt laden (gleiche Quelle wie Startseite).
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

  // Steuerung konfigurieren + EIN durchgängiger Einflug (Library-Tween, mit Controls koordiniert).
  useEffect(() => {
    const g = globeRef.current as any
    if (!g || !ready) return
    const c = g.controls()
    c.autoRotate = false
    c.enablePan = false
    c.dampingFactor = 0.12
    c.rotateSpeed = 0.6
    c.zoomSpeed = 0.8
    try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)) } catch {}

    // Z-Fighting-Fix: react-globe.gl setzt near=0.05 / far=125000 (Verhältnis 2,5 Mio) -> der
    // Tiefenpuffer verliert massiv an Präzision (Facetten-Kanten flackern). Auf den real genutzten
    // Distanzbereich eingrenzen (Verhältnis ~2000). far wird nur bei skyRadius-Änderung gesetzt (nie).
    try {
      const R0 = g.getGlobeRadius() || 100
      c.minDistance = R0 * 1.05
      c.maxDistance = R0 * 12
      const cam = g.camera()
      cam.near = 1
      cam.far = R0 * 20
      cam.updateProjectionMatrix()
    } catch { /* Kamera/Controls noch nicht bereit */ }

    if (flewInRef.current) { c.enableRotate = true; c.enableZoom = true; return }
    if (loading) return // Ziel (Pin-Schwerpunkt) steht noch nicht fest -> Kamera bleibt am Fernpunkt

    flewInRef.current = true
    flyingInRef.current = true
    // WICHTIG: Controls AKTIV lassen, nur die EINGABE sperren. Mit c.enabled=false blockiert
    // react-globe.gl den Kamera-Tween (Globus friert am Fernpunkt ein – per Test verifiziert).
    c.enableRotate = false
    c.enableZoom = false

    const target = pins.length
      ? { lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length, lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length }
      : { lat: 25, lng: 0 }
    // Sanfter Einflug über react-globe.gls eigenen Tween (Quadratic.Out = Ease-Out). Fernpunkt
    // wurde in onGlobeReady gesetzt -> kein Default-Frame-Sprung.
    g.pointOfView({ lat: target.lat, lng: target.lng, altitude: FLY_IN_END_ALTITUDE }, FLY_IN_MS)
    const done = window.setTimeout(() => {
      flyingInRef.current = false
      c.enableRotate = true // ab jetzt voll interaktiv (Drag/Zoom)
      c.enableZoom = true
    }, FLY_IN_MS)
    return () => window.clearTimeout(done)
  }, [ready, loading, pins])

  // 3D-Erdmodell laden und die Standard-Textur-Kugel ersetzen. Läuft einmal bei „ready",
  // räumt bei Unmount Geometrien/Materialien/Texturen restlos auf.
  useEffect(() => {
    const g = globeRef.current as any
    if (!g || !ready) return
    const scene: THREE.Scene = g.scene()
    const R: number = g.getGlobeRadius() || 100

    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/') // lokal gehostet -> offline-tauglich, kein CDN
    loader.setDRACOLoader(draco)
    let holder: THREE.Group | null = null
    let disposed = false

    loader.load(
      EARTH_MODEL,
      (gltf) => {
        if (disposed) return
        holder = new THREE.Group()
        holder.add(gltf.scene)
        // Zentrieren + auf Globus-Radius skalieren. Echter Kugelradius = größte Halb-Ausdehnung der
        // AABB (NICHT box.getBoundingSphere() – das liefert die AABB-Bounding-Sphere ≈ Radius·√3 und
        // skaliert das Modell viel zu klein). Mit maxHalfExtent passt der Modellradius exakt zu R.
        const box = new THREE.Box3().setFromObject(holder)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const radius = Math.max(size.x, size.y, size.z) / 2 || R
        gltf.scene.position.sub(center)
        holder.scale.setScalar(R / radius)
        holder.rotation.set(
          THREE.MathUtils.degToRad(MODEL_ROTATION_DEG.x),
          THREE.MathUtils.degToRad(MODEL_ROTATION_DEG.y),
          THREE.MathUtils.degToRad(MODEL_ROTATION_DEG.z),
        )
        scene.add(holder)
      },
      undefined,
      (err) => console.error('Globus-Modell konnte nicht geladen werden:', err),
    )

    return () => {
      disposed = true
      draco.dispose()
      if (!holder) return
      scene.remove(holder)
      holder.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mm = mesh.material as THREE.Material | THREE.Material[] | undefined
        for (const mat of (Array.isArray(mm) ? mm : mm ? [mm] : [])) {
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'specularMap'] as const) {
            const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[key]
            if (tex?.dispose) tex.dispose()
          }
          mat.dispose()
        }
      })
    }
  }, [ready])

  // Dekorative Effekte (Wolken-Drift, gelegentliche Blitze) – eine gemeinsame rAF-Schleife.
  useEffect(() => {
    const g = globeRef.current as any
    if (!g || !ready) return
    const scene: THREE.Scene = g.scene()
    const R: number = g.getGlobeRadius()
    const added: THREE.Object3D[] = []
    const disposables: Array<{ dispose: () => void }> = []

    const puffGeo = new THREE.SphereGeometry(1, CLOUD_PUFF_SEGMENTS, CLOUD_PUFF_SEGMENTS - 2)
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: CLOUD_OPACITY, depthWrite: false })
    disposables.push(puffGeo, puffMat)
    const cloudPivots: Array<{ pivot: THREE.Object3D; speed: number }> = []
    for (const region of CLOUD_REGIONS) {
      for (let k = 0; k < CLOUD_CLUSTERS_PER_REGION; k++) {
        const lat = region.lat + (Math.random() - 0.5) * 42
        const lng = region.lng + (Math.random() - 0.5) * 60
        const pivot = new THREE.Group()
        const clump = new THREE.Group()
        const pos = g.getCoords(lat, lng, CLOUD_ALTITUDE)
        clump.position.set(pos.x, pos.y, pos.z)
        clump.lookAt(0, 0, 0)
        const base = R * (0.05 + Math.random() * 0.03)
        const n = 3 + Math.floor(Math.random() * 3)
        for (let i = 0; i < n; i++) {
          const puff = new THREE.Mesh(puffGeo, puffMat)
          puff.scale.setScalar(base * (0.6 + Math.random() * 0.7))
          puff.position.set(
            (Math.random() - 0.5) * base * 2.4,
            (Math.random() - 0.5) * base * 1.0,
            (Math.random() - 0.5) * base * 0.5,
          )
          clump.add(puff)
        }
        pivot.add(clump)
        scene.add(pivot); added.push(pivot)
        cloudPivots.push({ pivot, speed: CLOUD_DRIFT_MIN + Math.random() * (CLOUD_DRIFT_MAX - CLOUD_DRIFT_MIN) })
      }
    }

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

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      for (const c of cloudPivots) c.pivot.rotation.y += c.speed * dt
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

  // Custom-Layer: 3D-Stecknadel pro Kampagne (einzige Pin-Darstellung).
  const buildPin = useCallback((d: object) => buildPushpin(d as Pin), [])
  const positionPin = useCallback((obj: object, d: object) => {
    const g = globeRef.current as any
    if (!g) return
    const p = d as Pin
    const c = g.getCoords(p.lat, p.lng, 0) // Oberflächenpunkt (Alt 0) im Globus-Koordinatensystem
    const o = obj as THREE.Object3D
    o.position.set(c.x, c.y, c.z)
    o.quaternion.setFromUnitVectors(PIN_UP, new THREE.Vector3(c.x, c.y, c.z).normalize()) // +Y radial nach außen
  }, [])

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          showGlobe={false}   // KEINE Standard-Textur-Kugel – das GLB-Modell ersetzt sie vollständig
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.14}
          animateIn={false}
          onGlobeReady={() => {
            // Sofort weit weg + Eingabe sperren (NUR Rotate/Zoom, NICHT controls.enabled!),
            // BEVOR react-globe.gl einen Default-Frame zeigt -> Einflug startet ohne Sprung.
            const g = globeRef.current as unknown as GlobeMethods & {
              controls: () => { enableRotate: boolean; enableZoom: boolean }
            }
            if (g) {
              try { const ctrl = g.controls(); ctrl.enableRotate = false; ctrl.enableZoom = false } catch { /* noch nicht bereit */ }
              g.pointOfView({ lat: FLY_IN_FROM.lat, lng: FLY_IN_FROM.lng, altitude: FLY_IN_START_ALTITUDE }, 0)
            }
            setReady(true)
          }}
          customLayerData={pins}
          customThreeObject={buildPin}
          customThreeObjectUpdate={positionPin}
          onCustomLayerClick={(d: object) => { if (!flyingInRef.current) setSelected(d as Pin) }}
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

            {selected.campaign.description && (
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{selected.campaign.description}</p>
            )}

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
