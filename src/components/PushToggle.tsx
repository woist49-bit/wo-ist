import { useEffect, useState } from 'react'
import { Toggle } from './ui/Toggle'
import { useToast } from '../stores/toast'
import { pushSupported, pushConfigured, isPushEnabled, enablePush, disablePush } from '../lib/push'

// Opt-in-Umschalter für Push-Benachrichtigungen (nur eigenes Profil). Zeigt je nach
// Gerät/Zustand einen passenden Hinweis und löst die offizielle Erlaubnis-Abfrage aus.
export function PushToggle({ userId }: { userId: string }) {
  const { addToast } = useToast()
  const supported = pushSupported()
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) { setReady(true); return }
    isPushEnabled().then(v => { setEnabled(v); setReady(true) }).catch(() => setReady(true))
  }, [supported])

  if (!supported) {
    return (
      <p className="mt-6 text-xs text-white/40 text-center leading-relaxed">
        Benachrichtigungen werden auf diesem Gerät nicht unterstützt. Auf dem iPhone gehen sie nur,
        wenn du die App über „Zum Home-Bildschirm" installierst.
      </p>
    )
  }
  if (!ready) return null

  async function toggle(v: boolean) {
    if (!pushConfigured()) { addToast('Benachrichtigungen sind noch nicht eingerichtet.', 'error', 6000); return }
    setBusy(true)
    try {
      if (v) {
        const { error } = await enablePush(userId)
        if (error === 'DENIED') {
          addToast('Du hast Benachrichtigungen blockiert. Erlaube sie in den Browser-Einstellungen der Seite.', 'error', 8000)
          return
        }
        if (error) { addToast('Aktivieren fehlgeschlagen. Versuch es nochmal.', 'error', 6000); return }
        setEnabled(true)
        addToast('Benachrichtigungen aktiviert.', 'success')
      } else {
        await disablePush(userId)
        setEnabled(false)
        addToast('Benachrichtigungen deaktiviert.', 'success')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6">
      <Toggle
        checked={enabled}
        onChange={toggle}
        disabled={busy}
        label="Benachrichtigungen"
        hint="Hinweis bei neuen Bildern, neuen Live-Events und Ergebnissen."
      />
    </div>
  )
}
