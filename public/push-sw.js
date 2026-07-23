// Wird per workbox.importScripts in den von vite-plugin-pwa generierten Service Worker
// eingebunden. Zeigt eingehende Push-Nachrichten als OS-Benachrichtigung und öffnet beim
// Klick die App an der mitgeschickten URL.
/* global self */

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }

  const title = data.title || 'Wo ist...?'
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag,               // gleiche tag -> ersetzt statt stapelt (z. B. pro Event)
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Ist die App schon offen -> fokussieren und dorthin navigieren.
    for (const client of all) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) { try { await client.navigate(url) } catch (e) { /* ignore */ } }
        return
      }
    }
    // Sonst neues Fenster öffnen.
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
