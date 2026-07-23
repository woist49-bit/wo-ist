import { useEffect, useState } from 'react'
import { Toggle } from './ui/Toggle'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'
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
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!supported) { setReady(true); return }
    isPushEnabled().then(v => { setEnabled(v); setReady(true) }).catch(() => setReady(true))
  }, [supported])

  if (!supported) {
    return (
      <p className="text-xs text-white/40 text-center leading-relaxed">
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

  // Selbst-Test: ruft die Edge Function 'send-push' auf. Das User-JWT hängt invoke automatisch
  // an -> die Function schickt den Push nur an die eigenen Geräte.
  async function sendTest() {
    setTesting(true)
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { title: 'Wo ist...?', body: 'Test-Benachrichtigung – es funktioniert! 🎉', url: '/' },
    })
    setTesting(false)
    if (error) {
      // Die echte Fehlermeldung der Function herausziehen (FunctionsHttpError -> context = Response).
      let detail = ''
      const ctx = (error as { context?: unknown }).context
      if (ctx instanceof Response) {
        try { detail = ((await ctx.json()) as { error?: string })?.error ?? '' } catch { /* kein JSON-Body */ }
      }
      addToast(
        detail ? `Test fehlgeschlagen: ${detail}` : 'Test fehlgeschlagen – ist die Edge Function „send-push" deployed?',
        'error', 9000,
      )
      return
    }
    const sent = (data as { sent?: number } | null)?.sent ?? 0
    addToast(
      sent > 0 ? 'Test verschickt – gleich sollte die Benachrichtigung kommen.' : 'Kein Abo gefunden.',
      sent > 0 ? 'success' : 'error', 6000,
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Toggle
        checked={enabled}
        onChange={toggle}
        disabled={busy}
        label="Benachrichtigungen"
        hint="Hinweis bei neuen Bildern, neuen Live-Events und Ergebnissen."
      />
      {enabled && (
        <Button variant="secondary" size="sm" className="w-full" loading={testing} onClick={sendTest}>
          Test-Benachrichtigung senden
        </Button>
      )}
    </div>
  )
}
