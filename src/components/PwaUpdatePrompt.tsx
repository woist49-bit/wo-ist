import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui/Button'

// Wie oft ein bereits geöffneter PWA-Client beim Server nach einem neuen
// Service Worker fragt. Der Standard-Update-Check läuft beim App-Start/Navigieren;
// dieser Intervall fängt zusätzlich lange offene Sessions ab.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 Stunde

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Periodisch nach Updates suchen, damit auch dauerhaft geöffnete Installationen
      // zeitnah den neuen Stand entdecken (nicht nur beim nächsten Kaltstart).
      setInterval(() => {
        registration.update().catch(() => {})
      }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <>
      <style>{`
        @keyframes pwaSlideDown {
          from { transform: translateY(-120%); opacity: 0; }
          to   { transform: translateY(0);      opacity: 1; }
        }
        .pwa-update-enter { animation: pwaSlideDown 0.3s ease-out; }
      `}</style>
      <div
        className="fixed top-0 left-0 right-0 z-[60] flex justify-center px-3 pointer-events-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="pwa-update-enter pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl bg-slate-800/95 backdrop-blur border border-white/10 shadow-xl px-4 py-3 text-white">
          <span className="text-2xl leading-none">🚀</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Neue Version verfügbar</div>
            <div className="text-xs text-white/60">Tippe auf „Neu laden", um zu aktualisieren.</div>
          </div>
          <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
            Neu laden
          </Button>
          <button
            onClick={() => setNeedRefresh(false)}
            aria-label="Später"
            className="text-white/50 hover:text-white transition text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}
