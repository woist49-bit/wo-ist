import { useRef, useState, useEffect } from 'react'

export interface ViewerMarker {
  x_rel: number        // 0..1 der natürlichen Bildbreite
  y_rel: number        // 0..1 der natürlichen Bildhöhe
  radius_px?: number   // Radius in NATÜRLICHEN Bildpixeln -> wenn gesetzt, wird ein Kreis gezeichnet
  variant: 'pin' | 'ring'
  color: string        // 6-stelliger Hex, z. B. '#22c55e'
  pulse?: boolean
}

interface Props {
  imageUrl: string
  markers?: ViewerMarker[]
  onTap?: (x_rel: number, y_rel: number) => void
  onReady?: (naturalW: number, naturalH: number) => void
  height?: number | string
  interactive?: boolean
  className?: string
}

const MAX_ZOOM = 8
const TAP_THRESHOLD = 5 // px Bewegung -> darüber ist es ein Drag, kein Tap

interface Env {
  zoom: number
  pan: { x: number; y: number }
  nat: { w: number; h: number }
  vp: { w: number; h: number }
  fit: number
}

function clampPan(px: number, py: number, z: number, nat: { w: number; h: number }, vp: { w: number; h: number }) {
  const sw = nat.w * z
  const sh = nat.h * z
  let minX: number, maxX: number, minY: number, maxY: number
  if (sw <= vp.w) { minX = maxX = (vp.w - sw) / 2 } else { minX = vp.w - sw; maxX = 0 }
  if (sh <= vp.h) { minY = maxY = (vp.h - sh) / 2 } else { minY = vp.h - sh; maxY = 0 }
  return { x: Math.min(maxX, Math.max(minX, px)), y: Math.min(maxY, Math.max(minY, py)) }
}

export function ImageMarkerViewer({
  imageUrl,
  markers = [],
  onTap,
  onReady,
  height = 500,
  interactive = true,
  className = '',
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [vp, setVp] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const fitRef = useRef(1)
  const readyRef = useRef(false)
  // Aktueller, immer frischer Zustand für native Event-Handler (vermeidet stale closures)
  const envRef = useRef<Env>({ zoom: 1, pan: { x: 0, y: 0 }, nat, vp, fit: 1 })
  useEffect(() => { envRef.current = { zoom, pan, nat, vp, fit: fitRef.current } })

  // Pointer-Tracking für Pan / Pinch / Tap
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gesture = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    startPan: { x: 0, y: 0 },
    startZoom: 1,
    startDist: 0,
    startMid: { x: 0, y: 0 },
    moved: 0,
    startClient: { x: 0, y: 0 },
  })

  const clampZoom = (z: number) => Math.max(fitRef.current, Math.min(MAX_ZOOM, z))

  // Viewport vermessen
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fit berechnen sobald Bildgröße + Viewport bekannt sind
  useEffect(() => {
    if (!nat.w || !nat.h || !vp.w || !vp.h) return
    const fit = Math.min(vp.w / nat.w, vp.h / nat.h)
    fitRef.current = fit
    if (!readyRef.current) {
      readyRef.current = true
      setZoom(fit)
      setPan({ x: (vp.w - nat.w * fit) / 2, y: (vp.h - nat.h * fit) / 2 })
    } else {
      const nz = Math.max(fit, Math.min(MAX_ZOOM, envRef.current.zoom))
      setZoom(nz)
      setPan(clampPan(envRef.current.pan.x, envRef.current.pan.y, nz, nat, vp))
    }
  }, [nat, vp])

  // Desktop-Zoom: nativer, nicht-passiver Wheel-Listener (damit preventDefault greift)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { zoom: z0, pan: p0, nat: n, vp: v } = envRef.current
      if (!n.w) return
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const z1 = Math.max(fitRef.current, Math.min(MAX_ZOOM, z0 * factor))
      const imgX = (cx - p0.x) / z0
      const imgY = (cy - p0.y) / z0
      const np = clampPan(cx - imgX * z1, cy - imgY * z1, z1, n, v)
      setZoom(z1)
      setPan(np)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current
    if (!el) return
    try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const { zoom: z0, pan: p0 } = envRef.current

    if (pointers.current.size === 1) {
      gesture.current = {
        mode: 'pan', startPan: p0, startZoom: z0, startDist: 0,
        startMid: { x: 0, y: 0 }, moved: 0, startClient: { x: e.clientX, y: e.clientY },
      }
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const rect = el.getBoundingClientRect()
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top
      gesture.current = {
        mode: 'pinch', startPan: p0, startZoom: z0, startDist: dist,
        startMid: { x: midX, y: midY }, moved: 999, startClient: { x: 0, y: 0 },
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = viewportRef.current
    if (!el) return
    const g = gesture.current
    const { nat: n, vp: v } = envRef.current

    if (g.mode === 'pan' && pointers.current.size === 1) {
      const dx = e.clientX - g.startClient.x
      const dy = e.clientY - g.startClient.y
      g.moved = Math.max(g.moved, Math.hypot(dx, dy))
      setPan(clampPan(g.startPan.x + dx, g.startPan.y + dy, envRef.current.zoom, n, v))
    } else if (g.mode === 'pinch' && pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const rect = el.getBoundingClientRect()
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top
      const z1 = clampZoom(g.startZoom * (dist / g.startDist))
      const imgX = (g.startMid.x - g.startPan.x) / g.startZoom
      const imgY = (g.startMid.y - g.startPan.y) / g.startZoom
      setZoom(z1)
      setPan(clampPan(midX - imgX * z1, midY - imgY * z1, z1, n, v))
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current
    const g = gesture.current
    const wasTap = g.mode === 'pan' && g.moved < TAP_THRESHOLD && pointers.current.size === 1
    pointers.current.delete(e.pointerId)
    try { el?.releasePointerCapture(e.pointerId) } catch { /* noop */ }

    if (wasTap && interactive && onTap && el) {
      const { zoom: z0, pan: p0, nat: n } = envRef.current
      if (n.w) {
        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const xRel = (cx - p0.x) / z0 / n.w
        const yRel = (cy - p0.y) / z0 / n.h
        if (xRel >= 0 && xRel <= 1 && yRel >= 0 && yRel <= 1) onTap(xRel, yRel)
      }
    }

    if (pointers.current.size === 0) {
      gesture.current.mode = 'none'
    } else if (pointers.current.size === 1) {
      // Übergang Pinch -> Pan mit dem verbleibenden Finger
      const pt = [...pointers.current.values()][0]
      gesture.current = {
        mode: 'pan', startPan: envRef.current.pan, startZoom: envRef.current.zoom, startDist: 0,
        startMid: { x: 0, y: 0 }, moved: 999, startClient: { x: pt.x, y: pt.y },
      }
    }
  }

  const ready = nat.w > 0 && vp.w > 0

  return (
    <div
      ref={viewportRef}
      className={`relative overflow-hidden bg-black select-none ${className}`}
      style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Szene: nur das Bild wird transformiert */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          style={{ display: 'block', maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }}
          onLoad={e => {
            const im = e.currentTarget
            setNat({ w: im.naturalWidth, h: im.naturalHeight })
            onReady?.(im.naturalWidth, im.naturalHeight)
          }}
        />
      </div>

      {/* Marker-Layer: liegt IM Viewport, nicht in der Szene -> nie verzerrt */}
      {ready && markers.map((m, i) => {
        const sx = m.x_rel * nat.w * zoom + pan.x
        const sy = m.y_rel * nat.h * zoom + pan.y
        if (m.variant === 'ring' && m.radius_px != null) {
          const d = m.radius_px * zoom * 2
          return (
            <div
              key={i}
              className={m.pulse ? 'animate-pulse' : ''}
              style={{
                position: 'absolute', left: sx, top: sy, width: d, height: d,
                transform: 'translate(-50%, -50%)', borderRadius: '50%',
                border: `3px solid ${m.color}`, background: `${m.color}26`,
                pointerEvents: 'none',
              }}
            />
          )
        }
        // Pin
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: sx, top: sy, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
          >
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `3px solid ${m.color}`, background: `${m.color}33`, boxShadow: '0 0 0 2px rgba(0,0,0,0.5)' }} />
          </div>
        )
      })}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
