import { useState, useEffect } from 'react'
import { ImageMarkerViewer, type ViewerMarker } from './ImageMarkerViewer'
import { RadiusSlider } from './RadiusSlider'
import { Button } from '../ui/Button'
import type { EventImage } from '../../types'

// Admin-Editor: Marker setzen + Suchradius einstellen.
// Speichert x/y als normalisierte Koordinaten (0..1) und Radius als Bruchteil der kürzeren Bildseite.
export function BoundingBoxEditor({ image, onSave }: { image: EventImage; onSave: (x: number, y: number, r: number) => void }) {
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    image.target_x !== 0.5 || image.target_y !== 0.5 ? { x: image.target_x, y: image.target_y } : null
  )
  const [radiusPx, setRadiusPx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const shorter = Math.min(nat.w, nat.h) || 1
  useEffect(() => {
    if (nat.w && radiusPx === null) setRadiusPx(image.target_radius * shorter)
  }, [nat])

  const minR = 10
  const maxR = Math.max(shorter * 0.3, minR + 1)
  const r = radiusPx ?? shorter * 0.05

  const markers: ViewerMarker[] = pos
    ? [{ x_rel: pos.x, y_rel: pos.y, radius_px: r, variant: 'ring', color: '#22c55e' }]
    : []

  async function save() {
    if (!pos) return
    setSaving(true)
    const target_radius = r / shorter
    await onSave(pos.x, pos.y, target_radius)
    setSaving(false)
  }

  return (
    <div className="mt-4 p-4 bg-slate-800 rounded-2xl border border-slate-700">
      <p className="text-xs text-white/60 mb-3">
        Tippe/klicke ins Bild um Paul zu markieren. Scrollen oder zwei Finger zum Zoomen, ziehen zum Verschieben.
      </p>
      <div className="mb-4 rounded-lg overflow-hidden">
        <ImageMarkerViewer
          imageUrl={image.image_url}
          markers={markers}
          height={420}
          onReady={(w, h) => setNat({ w, h })}
          onTap={(x, y) => setPos({ x, y })}
        />
      </div>

      {pos ? (
        <>
          <RadiusSlider value={r} min={minR} max={maxR} percent={(r / shorter) * 100} onChange={setRadiusPx} />
          <p className="text-xs text-white/40 text-center mb-4">
            Position: X={Math.round(pos.x * 100)}%, Y={Math.round(pos.y * 100)}%
          </p>
          <Button loading={saving} onClick={save} className="w-full" size="sm">
            ✓ Markierung speichern
          </Button>
        </>
      ) : (
        <p className="text-center text-xs text-white/40 py-2">Noch keine Markierung gesetzt – tippe ins Bild.</p>
      )}
    </div>
  )
}
