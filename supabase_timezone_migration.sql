-- =============================================
-- Zeitzonen-Fix / Anti-Cheat fuer Live-Event-Freischaltung
-- In Supabase (SQL-Editor) einmal ausfuehren.
-- =============================================

-- 1) Autoritative Serverzeit (UTC) fuer das Frontend
create or replace function server_now() returns timestamptz
  language sql stable as $$ select now() $$;
grant execute on function server_now() to anon, authenticated;

-- 2) player_attempts nur einfuegbar, wenn das Bild serverseitig freigeschaltet ist.
--    Verhindert vorzeitiges Spielen via manipulierter Geraete-Uhr/Client.
--    Betrifft nur Live-Events (Kampagnen laufen ueber campaign_progress).
drop policy if exists "Users can insert own attempt" on player_attempts;
create policy "Users can insert own attempt" on player_attempts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from event_images ei
      where ei.id = player_attempts.image_id and ei.unlocks_at <= now()
    )
  );

-- 3) ALTDATEN PRUEFEN (nur Anzeige, aendert nichts):
--    Zeigt die gespeicherten Freischaltzeiten in Europe/Berlin. Erwartung: alle zur
--    eingestellten taeglichen Uhrzeit (z. B. 09:00). Weichen sie ab, wurden sie mit einer
--    falschen Zeitzone gespeichert.
-- select ei.id, e.title,
--        ei.unlocks_at as gespeichert_utc,
--        (ei.unlocks_at at time zone 'Europe/Berlin') as berlin_zeit
-- from event_images ei
-- join live_events e on e.id = ei.event_id
-- order by ei.unlocks_at;

-- 3b) FALLS eine Korrektur noetig ist (Beispiel: Zeiten wurden um exakt X Stunden falsch
--     gespeichert), so anpassen — vorher unbedingt mit 3) pruefen:
-- update event_images set unlocks_at = unlocks_at + interval '1 hour'
-- where event_id in (select id from live_events where world_id = '...');
