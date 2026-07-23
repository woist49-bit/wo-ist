import { supabase } from './supabase'

// Öffentlicher VAPID-Key (base64url). Kommt aus der Umgebung (.env / Vercel).
// Der PRIVATE Gegenpart bleibt geheim auf dem Server (Edge Function, Teil 2).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// Unterstützt dieses Gerät/dieser Browser Web-Push überhaupt?
// (iOS: nur als installierte PWA vom Home-Bildschirm.)
export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

// Ist der VAPID-Key hinterlegt? Ohne ihn kann kein Abo angelegt werden.
export function pushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

// Läuft auf DIESEM Gerät bereits ein Abo?
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  return !!(await reg.pushManager.getSubscription())
}

// Erlaubnis holen (offizielle Browser-Abfrage), Abo anlegen, in der DB speichern.
// Muss aus einer Nutzer-Aktion (Klick) heraus aufgerufen werden – sonst blockt der
// Browser die Erlaubnis-Abfrage. Gibt einen Fehlercode zurück (oder null bei Erfolg).
export async function enablePush(userId: string): Promise<{ error: string | null }> {
  if (!pushSupported()) return { error: 'UNSUPPORTED' }
  if (!VAPID_PUBLIC_KEY) return { error: 'NOT_CONFIGURED' }

  // Offizielle Erlaubnis-Abfrage (zuerst, ohne await davor -> bleibt in der Klick-Geste).
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { error: perm === 'denied' ? 'DENIED' : 'DISMISSED' }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // Web-Push-Pflicht: jede Nachricht MUSS sichtbar sein
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { error: 'BAD_SUBSCRIPTION' }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 300),
  }, { onConflict: 'user_id,endpoint' })
  if (error) return { error: 'DB' }
  return { error: null }
}

// Abo auf diesem Gerät beenden + DB-Zeile entfernen.
export async function disablePush(userId: string): Promise<{ error: string | null }> {
  if (!pushSupported()) return { error: null }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {})
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
  }
  return { error: null }
}

// VAPID-Public-Key (base64url) -> Uint8Array für applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  // Puffer explizit als ArrayBuffer anlegen -> erfüllt BufferSource (applicationServerKey).
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
