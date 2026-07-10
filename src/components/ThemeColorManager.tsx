import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Farbe der Statusleiste (theme-color-Meta) pro Screen. Das ist NUR die Tönung der
// System-/Browser-Statusleiste (Android-Chrome, iOS-Safari-Toolbar) – KEIN Hintergrund.
// Der Safe-Area-Hintergrund kommt allein aus body { background-color } in index.css.
function topColorForPath(path: string): string {
  const p = path.replace(/\/+$/, '') || '/'
  if (/\/image\/[^/]+$/.test(p)) return '#000000'                 // Spielscreen (Vollbild schwarz)
  if (p === '/profile' || p.endsWith('/profile')) return '#0284c7' // Profil-Hero (sky-600)
  if (p === '/datenschutz') return '#475569'                      // slate-600
  if (p === '/tutorial') return '#475569'                         // Tutorial: slate-600
  if (p === '/shop') return '#475569'                             // Shop: slate-600
  if (/^\/world\/[^/]+$/.test(p)) return '#0284c7'                // Welt-Startseite: Header/Hero sky-600
  if (/^\/world\//.test(p)) return '#475569'                      // übrige Welt-Screens: slate-600
  if (p === '/worlds' || p === '/leaderboard') return '#0f766e'   // Hauptmenü: teal-700
  return '#475569'                                                 // Auth / Fallback: slate-600
}

export function ThemeColorManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', topColorForPath(pathname))
  }, [pathname])
  return null
}
