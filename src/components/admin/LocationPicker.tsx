import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Zoombare/verschiebbare Weltkarte (Leaflet + OpenStreetMap-Tiles). Zoom (Pinch/Scroll),
// Drag und Klick->Koordinaten sind in Leaflet eingebaut – keine eigene Koordinaten-Logik.
// Marker als divIcon mit Inline-SVG: umgeht den bekannten Leaflet-Marker-Bild-Bug unter Bundlern.
const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))"><path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.3" fill="#ffffff" stroke="none"/></svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30], // Spitze unten-mittig auf der Koordinate
})

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

export function LocationPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  function setMarker(la: number, lo: number) {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) markerRef.current.setLatLng([la, lo])
    else markerRef.current = L.marker([la, lo], { icon: PIN_ICON }).addTo(map)
  }

  // Karte einmalig aufbauen
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat ?? 20, lng ?? 0],
      zoom: lat != null ? 5 : 2,
      worldCopyJump: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const la = Math.round(e.latlng.lat * 1e5) / 1e5
      const lo = Math.round(e.latlng.wrap().lng * 1e5) / 1e5 // .wrap(): Länge in -180..180 halten
      setMarker(la, lo)
      onChangeRef.current(la, lo)
    })

    mapRef.current = map
    if (lat != null && lng != null) setMarker(lat, lng)
    // Container liegt in einem Flex-Layout -> Größe nach Mount neu berechnen, sonst grauer Kasten.
    setTimeout(() => map.invalidateSize(), 0)

    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marker mit dem Prop synchron halten (z. B. Reset auf null nach dem Anlegen)
  useEffect(() => {
    if (!mapRef.current) return
    if (lat == null || lng == null) {
      if (markerRef.current) { mapRef.current.removeLayer(markerRef.current); markerRef.current = null }
    } else {
      setMarker(lat, lng)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  const has = lat != null && lng != null
  return (
    <div>
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden border-2 border-[#e6d3a3] bg-slate-200" style={{ height: 220 }} />
      <p className="text-xs text-slate-500 mt-1">
        {has ? `Standort gesetzt: ${lat!.toFixed(4)}, ${lng!.toFixed(4)}` : 'Zoomen, verschieben und antippen, um den Standort präzise festzulegen.'}
      </p>
    </div>
  )
}
