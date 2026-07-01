import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Farbe am oberen Bildschirmrand (Android-Statusleiste via theme-color, iOS via body-bg).
// Pro Screen die Farbe, die dort oben tatsächlich zu sehen ist – so gibt es keinen
// Farbwechsel zwischen Statusleiste/Rand und dem App-Hintergrund.
function edgeColorForPath(path: string): string {
  const p = path.replace(/\/+$/, '') || '/'
  if (/\/image\/[^/]+$/.test(p)) return '#000000'                 // Spielscreen (Vollbild schwarz)
  if (p === '/profile' || p.endsWith('/profile')) return '#0284c7' // Profil-Hero (sky-600)
  if (p === '/datenschutz') return '#475569'                      // slate-600
  if (/^\/world\/[^/]+$/.test(p)) return '#0284c7'                // Welt-Startseite: Header/Hero sky-600
  if (/^\/world\//.test(p)) return '#475569'                      // übrige Welt-Screens: slate-600
  if (p === '/worlds' || p === '/leaderboard') return '#0f766e'   // Hauptmenü: teal-700
  return '#475569'                                                 // Auth / Fallback: slate-600
}

export function ThemeColorManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    const color = edgeColorForPath(pathname)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    document.body.style.backgroundColor = color
  }, [pathname])
  return null
}
