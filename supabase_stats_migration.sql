-- =====================================================================
-- WO IST...? – Profil-Statistiken: Kampagnen-Daten + neue Felder,
-- sowie limit-freie Gesamtpunkte/Siege für die Profilseite.
-- In der Supabase SQL-Konsole ausführen.
-- =====================================================================


-- =====================================================================
-- SCHRITT 1 – user_play_stats: Live + Kampagne zusammenzählen,
-- plus Durchschnittszeit, abgeschlossene Kampagnen/Events.
-- (Rückgabetyp geändert -> vorher droppen.)
-- =====================================================================
drop function if exists user_play_stats(uuid);
create function user_play_stats(p_user_id uuid)
returns table(
  total bigint, finds bigint, avg_find_seconds numeric,
  completed_campaigns bigint, completed_events bigint
)
language sql security definer as $$
  select
    -- Gespielte Bilder = Live-Versuche + Kampagnen-Versuche
    ((select count(*) from player_attempts where user_id = p_user_id)
     + (select count(*) from campaign_progress where user_id = p_user_id))::bigint,
    -- Gefundene Bilder = korrekte Live-Funde + gefundene Kampagnen-Bilder
    ((select count(*) from player_attempts where user_id = p_user_id and is_correct)
     + (select count(*) from campaign_progress cp where cp.user_id = p_user_id and cp.found))::bigint,
    -- Durchschnittliche Suchzeit über korrekte Funde. Hinweis: nur Live-Funde tracken Zeit
    -- (campaign_progress speichert keine time_seconds) -> Schnitt basiert auf Live-Funden.
    (select avg(time_seconds) from player_attempts where user_id = p_user_id and is_correct),
    -- Abgeschlossene Kampagnen = alle Bilder der Kampagne gefunden (Legacy-Bilder ODER Original-Event-Bilder)
    (select count(*) from campaigns c
       where (select count(*) from event_images ei
              where ei.campaign_id = c.id
                 or (c.original_event_id is not null and ei.event_id = c.original_event_id)) > 0
         and (select count(*) from event_images ei
              where ei.campaign_id = c.id
                 or (c.original_event_id is not null and ei.event_id = c.original_event_id))
           = (select count(distinct cp.image_id) from campaign_progress cp
              where cp.campaign_id = c.id and cp.user_id = p_user_id and cp.found))::bigint,
    -- Abgeschlossene Live-Events = beendete Events mit mind. einem korrekten Fund des Spielers
    (select count(distinct le.id)
     from live_events le
     join event_images ei on ei.event_id = le.id
     join player_attempts pa on pa.image_id = ei.id
     where le.status = 'finished' and pa.user_id = p_user_id and pa.is_correct)::bigint;
$$;


-- =====================================================================
-- SCHRITT 2 – user_totals: Gesamtpunkte + Siege eines Spielers,
-- limit-frei (unabhängig von der Platzierung) für die Profilseite.
-- =====================================================================
create or replace function user_totals(p_user_id uuid)
returns table(total_points bigint, wins bigint)
language sql security definer as $$
  select
    -- Gesamtpunkte über alle Welten (Live + Kampagne)
    (coalesce((select sum(points) from player_attempts where user_id = p_user_id), 0)
     + coalesce((select sum(points) from campaign_progress where user_id = p_user_id), 0))::bigint,
    -- Siege = Rang 1 nach Punkten in beendeten Events (alle Welten, Punkte > 0)
    (select count(*)::bigint from (
       select ep.user_id, rank() over (partition by ep.event_id order by ep.pts desc) as rnk
       from (
         select ei.event_id, pa.user_id, sum(pa.points) as pts
         from player_attempts pa
         join event_images ei on ei.id = pa.image_id
         join live_events le on le.id = ei.event_id and le.status = 'finished'
         group by ei.event_id, pa.user_id
       ) ep
       where ep.pts > 0
     ) r where r.rnk = 1 and r.user_id = p_user_id);
$$;
