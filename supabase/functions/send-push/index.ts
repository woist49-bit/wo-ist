// Supabase Edge Function: verschickt Web-Push-Benachrichtigungen.
// Zwei Aufruf-Wege:
//   1) Selbst-Test aus der App: mit gültigem User-JWT (Authorization-Header, von
//      supabase.functions.invoke automatisch gesetzt) -> Push nur an die EIGENEN Geräte.
//   2) Server-zu-Server (Cron/Trigger, Phase 3): Header x-push-secret == PUSH_SEND_SECRET
//      -> Ziel frei wählbar (user_ids und/oder world_id).
//
// Secrets (in Supabase unter Edge Functions -> Secrets setzen):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), PUSH_SEND_SECRET (Phase 3).
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden von Supabase automatisch bereitgestellt.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const SEND_SECRET = Deno.env.get('PUSH_SEND_SECRET') ?? ''

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret',
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const title = (body.title as string) ?? 'Wo ist...?'
    const text = (body.body as string) ?? ''
    const url = (body.url as string) ?? '/'
    const tag = body.tag as string | undefined

    let userIds: string[] = []
    const secret = req.headers.get('x-push-secret')

    if (secret && SEND_SECRET && secret === SEND_SECRET) {
      // Server-zu-Server: Ziel aus dem Body.
      if (Array.isArray(body.user_ids)) userIds.push(...(body.user_ids as string[]))
      if (typeof body.world_id === 'string') {
        const { data } = await admin.from('world_members').select('user_id').eq('world_id', body.world_id)
        userIds.push(...(data ?? []).map((r: { user_id: string }) => r.user_id))
      }
      if (typeof body.exclude_user_id === 'string') {
        userIds = userIds.filter((id) => id !== body.exclude_user_id)
      }
    } else {
      // Selbst-Test: gültiges User-JWT nötig -> nur eigene Geräte.
      const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
      const { data } = await admin.auth.getUser(jwt)
      if (!data.user) return json({ error: 'unauthorized' }, 401)
      userIds = [data.user.id]
    }

    userIds = [...new Set(userIds)]
    if (userIds.length === 0) return json({ sent: 0 })

    const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
    const payload = JSON.stringify({ title, body: text, url, tag })

    let sent = 0
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        // 404/410 = Abo abgelaufen/abgemeldet -> aufräumen.
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
    return json({ sent })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
