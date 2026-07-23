-- =============================================================================
-- WO IST...? – Push-Benachrichtigungen Teil 3: automatische Auslöser
-- Voraussetzungen:
--   1) Extensions pg_cron UND pg_net aktiviert (Database -> Extensions).
--   2) Edge Function send-push deployed (Teil 2).
--   3) Secret PUSH_SEND_SECRET ist BEIDES: Edge-Function-Secret UND unten eingesetzt
--      (Platzhalter __PUSH_SEND_SECRET__ im SQL-Editor durch den echten Wert ersetzen).
--
-- Auslöser: neues freigeschaltetes Live-Event-Bild, neues (aktiviertes) Live-Event,
-- beendetes Event. Ein Minuten-Cron pollt Neuerungen und ruft send-push (world_id) auf.
-- =============================================================================

-- Dedup: was wurde schon benachrichtigt (verhindert Doppel-Pushes)
create table if not exists push_log (
  kind text not null,           -- 'image' | 'event_new' | 'event_done'
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (kind, ref_id)
);

create or replace function dispatch_push()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  fn_url text := 'https://ywslhfxdqvlzpbmfpwvd.supabase.co/functions/v1/send-push';
  secret text := '__PUSH_SEND_SECRET__';       -- <-- im SQL-Editor durch das echte PUSH_SEND_SECRET ersetzen
  -- Öffentlicher anon-Key: nötig als Authorization-Header, sonst blockt das Supabase-Gateway
  -- den Aufruf mit 401 "Missing authorization header", bevor die Function läuft. Nicht geheim
  -- (steckt ohnehin im Client-Bundle). Zu finden unter Project Settings -> API -> anon public.
  anon text := '__SUPABASE_ANON_KEY__';         -- <-- im SQL-Editor durch den anon-Key ersetzen
begin
  -- Fällige Events serverseitig beenden, damit "Event beendet" auch dann kommt, wenn niemand
  -- die App öffnet (finish_due_events lief sonst nur beim Laden einer Spielwelt).
  perform finish_due_events(w.id) from worlds w;

  -- 1) Neu freigeschaltete LIVE-Event-Bilder (nur event_id, keine Kampagnen-Bilder)
  for r in
    select ei.id, ei.world_id from event_images ei
    where ei.event_id is not null and ei.unlocks_at <= now()
      and not exists (select 1 from push_log pl where pl.kind = 'image' and pl.ref_id = ei.id)
  loop
    insert into push_log(kind, ref_id) values ('image', r.id);
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon, 'x-push-secret', secret),
      body := jsonb_build_object('world_id', r.world_id,
        'title', 'Neues Bild ist da! 🔍', 'body', 'Im Live-Event wurde ein neues Bild freigeschaltet.',
        'url', '/', 'tag', 'img-' || r.world_id)
    );
  end loop;

  -- 2) Neue (aktivierte) Live-Events
  for r in
    select le.id, le.world_id, le.title from live_events le
    where le.status = 'active'
      and not exists (select 1 from push_log pl where pl.kind = 'event_new' and pl.ref_id = le.id)
  loop
    insert into push_log(kind, ref_id) values ('event_new', r.id);
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon, 'x-push-secret', secret),
      body := jsonb_build_object('world_id', r.world_id,
        'title', 'Neues Live-Event! 🔴', 'body', coalesce(r.title, 'Ein neues Live-Event') || ' ist gestartet.',
        'url', '/', 'tag', 'ev-' || r.id)
    );
  end loop;

  -- 3) Beendete Events
  for r in
    select le.id, le.world_id, le.title from live_events le
    where le.status = 'finished'
      and not exists (select 1 from push_log pl where pl.kind = 'event_done' and pl.ref_id = le.id)
  loop
    insert into push_log(kind, ref_id) values ('event_done', r.id);
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon, 'x-push-secret', secret),
      body := jsonb_build_object('world_id', r.world_id,
        'title', 'Event beendet! 🏁', 'body', coalesce(r.title, 'Ein Live-Event') || ' ist vorbei – sieh dir das Ergebnis an.',
        'url', '/', 'tag', 'done-' || r.id)
    );
  end loop;
end;
$$;

-- Bestehenden Stand als "schon benachrichtigt" markieren -> der erste Lauf blastet NICHT alle Altbestände.
insert into push_log(kind, ref_id) select 'image', id from event_images where event_id is not null and unlocks_at <= now() on conflict do nothing;
insert into push_log(kind, ref_id) select 'event_new', id from live_events where status = 'active' on conflict do nothing;
insert into push_log(kind, ref_id) select 'event_done', id from live_events where status = 'finished' on conflict do nothing;

-- Jede Minute ausführen (vorhandenen Job gleichen Namens vorher entfernen -> Skript ist wiederholbar).
do $$ begin perform cron.unschedule('push-dispatch'); exception when others then null; end $$;
select cron.schedule('push-dispatch', '* * * * *', $$ select dispatch_push(); $$);
