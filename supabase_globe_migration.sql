-- =============================================
-- Globus-Feature: Standort-Koordinaten für Kampagnen & Live-Events
-- In Supabase (SQL-Editor) einmal ausführen.
-- =============================================

-- 1) Neue Spalten (idempotent)
alter table live_events add column if not exists latitude float8;
alter table live_events add column if not exists longitude float8;
alter table campaigns  add column if not exists latitude float8;
alter table campaigns  add column if not exists longitude float8;

-- 2) Archivierung: Event-Koordinaten an die entstehende Kampagne weiterreichen
create or replace function finish_due_events(p_world_id uuid)
returns void language plpgsql security definer as $$
declare
  ev record;
  deadline timestamptz;
begin
  for ev in select * from live_events where world_id = p_world_id and status = 'active' loop
    -- Frist = Enddatum (letzter Tag) + 24h; falls Bilder darüber hinausgehen, das späteste Bild + 24h.
    select greatest(coalesce(max(ei.unlocks_at), ev.ends_at), ev.ends_at) + interval '24 hours'
      into deadline from event_images ei where ei.event_id = ev.id;
    if now() >= deadline then
      update live_events set status = 'finished' where id = ev.id;
      if not exists (select 1 from campaigns where original_event_id = ev.id) then
        insert into campaigns (world_id, title, original_event_id, is_legacy, latitude, longitude)
        values (ev.world_id, ev.title, ev.id, false, ev.latitude, ev.longitude);
      end if;
    end if;
  end loop;
end;
$$;

-- Optional: bestehenden Kampagnen nachträglich einen Standort geben, z. B.:
-- update campaigns set latitude = 48.14, longitude = 11.58 where title = 'Urlaub 2022';
