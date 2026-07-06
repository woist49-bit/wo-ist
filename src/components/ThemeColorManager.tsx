import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Farbe am OBEREN Bildschirmrand (Notch/Statusleiste). Pro Screen die Farbe,
// die dort oben tatsächlich zu sehen ist.
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

// Farbe am UNTEREN Bildschirmrand (Home-Indicator). Fast alle Layouts enden im
// dunklen Verlauf – nur Spielscreen (schwarz) und Profil (slate-900) weichen ab.
function bottomColorForPath(path: string): string {
  const p = path.replace(/\/+$/, '') || '/'
  if (/\/image\/[^/]+$/.test(p)) return '#000000'                 // Spielscreen: schwarz
  if (p === '/profile' || p.endsWith('/profile')) return '#0f172a' // Profil endet in slate-900
  return '#1e293b'                                                 // sonst slate-800 (Verlauf-Ende)
}

export function ThemeColorManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    const top = topColorForPath(pathname)
    const bottom = bottomColorForPath(pathname)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top)
    // Safe-Area-Streifen (siehe index.css) exakt einfärben – oben und unten getrennt
    document.documentElement.style.setProperty('--edge-top', top)
    document.documentElement.style.setProperty('--edge-bottom', bottom)
    document.body.style.backgroundColor = bottom // Fallback für nicht abgedeckte Ränder/Overscroll
  }, [pathname])
  return null
}
