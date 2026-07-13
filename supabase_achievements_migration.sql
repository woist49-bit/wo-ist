-- =====================================================================
-- WO IST...? – Achievements global + serverseitige Auswertung
-- In der Supabase SQL-Konsole ausführen.
--
-- Reihenfolge:
--   1. TEIL 0 zuerst laufen lassen (nur SELECT, löscht nichts) und die
--      Ausgabe sichern -> zeigt Mehrfach-Vergaben aus dem alten
--      spielwelt-bezogenen Modell inkl. zu viel gutgeschriebener XP/Gems.
--   2. Danach TEIL 1–5 ausführen.
--   3. Über eine eventuelle XP/Gems-Rückrechnung (TEIL 0-Ergebnis)
--      separat entscheiden – dafür gibt es unten KEIN automatisches UPDATE.
-- =====================================================================


-- =====================================================================
-- TEIL 0 – DIAGNOSE (nur lesen, NICHTS wird verändert). ZUERST ausführen.
-- Listet Achievements, die ein Spieler im alten Modell in mehreren
-- Spielwelten (mehrfach) erhalten hat, samt zu viel vergebener XP/Gems.
-- Nach dem DB-Reset ist diese Liste voraussichtlich leer -> dann ist die
-- Dedupe in TEIL 1 ein No-op.
-- =====================================================================
with reward as (
  select * from (values
    ('first_find',100,10), ('first_event',100,10), ('legacy_first',150,10), ('near_miss',100,10),
    ('tutorial_master',150,10),
    ('eagle_eye',500,25), ('no_miss',500,25), ('patient_finder',400,25), ('streak_5',600,25),
    ('first_win',1500,50), ('perfect_event',2500,50), ('campaign_king',1200,50), ('last_minute',1000,50)
  ) as r(key, xp, gems)
),
dupes as (
  select user_id, achievement_key, count(*) as awards, min(earned_at) as first_earned,
         array_agg(world_id) as worlds
  from player_achievements
  group by user_id, achievement_key
  having count(*) > 1
)
select
  pr.username,
  d.user_id,
  d.achievement_key,
  d.awards,
  (d.awards - 1) * coalesce(r.xp, 0)   as extra_xp_gutgeschrieben,
  (d.awards - 1) * coalesce(r.gems, 0) as extra_gems_gutgeschrieben,
  d.worlds
from dupes d
join profiles pr on pr.id = d.user_id
left join reward r on r.key = d.achievement_key
order by extra_xp_gutgeschrieben desc, pr.username;


-- =====================================================================
-- TEIL 1 – DATENMODELL: Achievements gelten global pro Spieler
-- world_id bleibt als Kontext-Spalte erhalten (für globale Vergaben NULL),
-- ist aber NICHT mehr Teil der Eindeutigkeit.
-- =====================================================================

-- 1a) Alten spielwelt-bezogenen Unique-Constraint entfernen
alter table player_achievements
  drop constraint if exists player_achievements_user_id_world_id_achievement_key_key;

-- 1b) Vorhandene Mehrfach-Zeilen bereinigen (nur die überzähligen ZEILEN;
--     XP/Gems bleiben unberührt – darüber separat entscheiden, s. TEIL 0).
--     Behalten wird jeweils die älteste Vergabe pro (user_id, achievement_key).
delete from player_achievements pa
using (
  select id, row_number() over (
           partition by user_id, achievement_key order by earned_at, id
         ) as rn
  from player_achievements
) d
where pa.id = d.id and d.rn > 1;

-- 1c) Neuer globaler Unique-Constraint: nur noch (user_id, achievement_key)
--     (drop-if-exists davor -> das Skript ist gefahrlos wiederholbar)
alter table player_achievements
  drop constraint if exists player_achievements_user_key_uniq;
alter table player_achievements
  add constraint player_achievements_user_key_uniq unique (user_id, achievement_key);

-- 1d) RLS: Achievements sind – wie Profile – öffentlich lesbar, damit sie
--     auch auf fremden Profilen und spielwelt-übergreifend sichtbar sind.
drop policy if exists "Users can view own achievements" on player_achievements;
drop policy if exists "Members can view achievements in world" on player_achievements;
drop policy if exists "Achievements are viewable" on player_achievements;
create policy "Achievements are viewable" on player_achievements for select using (true);


-- =====================================================================
-- TEIL 2 – unlock_achievement: globale Idempotenz über (user_id, key)
-- Vergibt XP/Gems genau EINMAL pro Spieler und Achievement, welt-übergreifend.
-- tutorial_master steht bewusst NICHT in den Reward-Tabellen -> beim Nachtrag
-- wird nur die Zeile gesetzt, keine XP/Gems doppelt vergeben.
-- =====================================================================
create or replace function unlock_achievement(p_user_id uuid, p_world_id uuid, p_key text)
returns boolean language plpgsql security definer as $$
declare
  xp_rewards jsonb := '{
    "first_find": 100, "first_event": 100, "legacy_first": 150, "near_miss": 100,
    "eagle_eye": 500, "no_miss": 500, "patient_finder": 400, "streak_5": 600,
    "first_win": 1500, "perfect_event": 2500, "campaign_king": 1200, "last_minute": 1000
  }'::jsonb;
  gem_rewards jsonb := '{
    "first_find": 10, "first_event": 10, "legacy_first": 10, "near_miss": 10,
    "eagle_eye": 25, "no_miss": 25, "patient_finder": 25, "streak_5": 25,
    "first_win": 50, "perfect_event": 50, "campaign_king": 50, "last_minute": 50
  }'::jsonb;
  xp integer;
begin
  insert into player_achievements (user_id, world_id, achievement_key)
  values (p_user_id, p_world_id, p_key)
  on conflict (user_id, achievement_key) do nothing;   -- GLOBAL: world_id spielt keine Rolle

  if found then
    xp := (xp_rewards ->> p_key)::integer;
    if xp is not null then
      perform add_xp(p_user_id, xp, p_world_id);
    end if;
    perform award_gems(p_user_id, coalesce((gem_rewards ->> p_key)::integer, 0), 'achievement', p_key);
    return true;
  end if;
  return false;
end;
$$;


-- =====================================================================
-- TEIL 3 – recheck_achievements(p_user_id): wertet ALLE 13 Achievements
-- global (über alle Spielwelten) aus den vorhandenen Daten aus, vergibt
-- fehlende idempotent und gibt die NEU freigeschalteten Keys zurück (fürs Banner).
--
-- Semantik (abgestimmt):
--   near_miss      : Live-Fehltipp, Distanz < 0.05 (normierter Euklid wie im Frontend)
--   patient_finder : Live-Fund > 300 s (Live = ein Versuch/Bild -> ohne Fehlversuch)
--   no_miss        : beendetes Event, jedes Bild korrekt
--   perfect_event  : wie no_miss, zusätzlich >= 10 Bilder
--   first_win      : Rang 1 nach Punkten in einem beendeten Event (Punkte > 0)
--   last_minute    : korrekter Live-Fund in den letzten 60 min vor Bild-Ablauf (unlocks_at + 24h)
-- =====================================================================
create or replace function recheck_achievements(p_user_id uuid)
returns text[] language plpgsql security definer as $$
declare
  newly text[] := '{}';
begin
  -- Sicherheit: eingeloggte Clients dürfen nur sich selbst prüfen.
  -- Service-Role/SQL-Konsole (auth.uid() ist NULL) darf beliebige Nutzer prüfen (Backfill).
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  -- 1) first_find – irgendein korrekter Fund (Live oder Kampagne)
  -- Hinweis: cp.found MUSS qualifiziert sein – "found" ist sonst die PL/pgSQL-Systemvariable.
  if exists (select 1 from player_attempts where user_id = p_user_id and is_correct)
     or exists (select 1 from campaign_progress cp where cp.user_id = p_user_id and cp.found) then
    if unlock_achievement(p_user_id, null, 'first_find') then newly := array_append(newly, 'first_find'); end if;
  end if;

  -- 2) first_event – an mindestens einem Live-Event teilgenommen
  if exists (select 1 from player_attempts where user_id = p_user_id) then
    if unlock_achievement(p_user_id, null, 'first_event') then newly := array_append(newly, 'first_event'); end if;
  end if;

  -- 3) legacy_first – ein Bild einer Legacy-Kampagne abgeschlossen
  if exists (
    select 1 from campaign_progress cp
    join campaigns c on c.id = cp.campaign_id
    where cp.user_id = p_user_id and cp.found and c.is_legacy
  ) then
    if unlock_achievement(p_user_id, null, 'legacy_first') then newly := array_append(newly, 'legacy_first'); end if;
  end if;

  -- 4) near_miss – Live-Fehltipp mit Distanz < 0.05
  if exists (
    select 1 from player_attempts pa
    join event_images ei on ei.id = pa.image_id
    where pa.user_id = p_user_id and not pa.is_correct
      and sqrt(power(pa.click_x - ei.target_x, 2) + power(pa.click_y - ei.target_y, 2)) < 0.05
  ) then
    if unlock_achievement(p_user_id, null, 'near_miss') then newly := array_append(newly, 'near_miss'); end if;
  end if;

  -- 5) tutorial_master – Tutorial abgeschlossen (kein XP über unlock_achievement -> reiner Nachtrag)
  if exists (select 1 from profiles where id = p_user_id and tutorial_completed) then
    if unlock_achievement(p_user_id, null, 'tutorial_master') then newly := array_append(newly, 'tutorial_master'); end if;
  end if;

  -- 6) eagle_eye – Live-Fund in < 5 s
  if exists (select 1 from player_attempts where user_id = p_user_id and is_correct and time_seconds < 5) then
    if unlock_achievement(p_user_id, null, 'eagle_eye') then newly := array_append(newly, 'eagle_eye'); end if;
  end if;

  -- 7) patient_finder – Live-Fund > 300 s
  if exists (select 1 from player_attempts where user_id = p_user_id and is_correct and time_seconds > 300) then
    if unlock_achievement(p_user_id, null, 'patient_finder') then newly := array_append(newly, 'patient_finder'); end if;
  end if;

  -- 8) streak_5 – 5 aufeinanderfolgende korrekte Live-Funde (nach Zeit sortiert)
  if exists (
    with a as (
      select is_correct,
             row_number() over (order by attempted_at, id)
               - row_number() over (partition by is_correct order by attempted_at, id) as grp
      from player_attempts where user_id = p_user_id
    )
    select 1 from a where is_correct group by grp having count(*) >= 5
  ) then
    if unlock_achievement(p_user_id, null, 'streak_5') then newly := array_append(newly, 'streak_5'); end if;
  end if;

  -- 9) no_miss – beendetes Event, in dem JEDES Bild korrekt gefunden wurde
  if exists (
    select 1 from live_events le
    where le.status = 'finished'
      and exists (select 1 from event_images ei where ei.event_id = le.id)
      and not exists (
        select 1 from event_images ei
        where ei.event_id = le.id
          and not exists (
            select 1 from player_attempts pa
            where pa.image_id = ei.id and pa.user_id = p_user_id and pa.is_correct
          )
      )
  ) then
    if unlock_achievement(p_user_id, null, 'no_miss') then newly := array_append(newly, 'no_miss'); end if;
  end if;

  -- 10) first_win – Rang 1 nach Punkten in einem beendeten Event (Punkte > 0)
  if exists (
    with event_pts as (
      select ei.event_id, pa.user_id, sum(pa.points) as pts
      from player_attempts pa
      join event_images ei on ei.id = pa.image_id
      join live_events le on le.id = ei.event_id and le.status = 'finished'
      group by ei.event_id, pa.user_id
    ),
    ranked as (
      select event_id, user_id, rank() over (partition by event_id order by pts desc) as rnk
      from event_pts where pts > 0
    )
    select 1 from ranked where user_id = p_user_id and rnk = 1
  ) then
    if unlock_achievement(p_user_id, null, 'first_win') then newly := array_append(newly, 'first_win'); end if;
  end if;

  -- 11) perfect_event – beendetes Event mit >= 10 Bildern, alle korrekt
  if exists (
    select 1 from live_events le
    where le.status = 'finished'
      and (select count(*) from event_images ei where ei.event_id = le.id) >= 10
      and not exists (
        select 1 from event_images ei
        where ei.event_id = le.id
          and not exists (
            select 1 from player_attempts pa
            where pa.image_id = ei.id and pa.user_id = p_user_id and pa.is_correct
          )
      )
  ) then
    if unlock_achievement(p_user_id, null, 'perfect_event') then newly := array_append(newly, 'perfect_event'); end if;
  end if;

  -- 12) campaign_king – alle Bilder einer Kampagne gefunden
  --     Bilder einer Kampagne = eigene Legacy-Bilder (campaign_id) ODER Bilder des Original-Events.
  if exists (
    select 1 from campaigns c
    where (
            select count(*) from event_images ei
            where ei.campaign_id = c.id
               or (c.original_event_id is not null and ei.event_id = c.original_event_id)
          ) > 0
      and (
            select count(*) from event_images ei
            where ei.campaign_id = c.id
               or (c.original_event_id is not null and ei.event_id = c.original_event_id)
          ) = (
            select count(distinct cp.image_id) from campaign_progress cp
            where cp.campaign_id = c.id and cp.user_id = p_user_id and cp.found
          )
  ) then
    if unlock_achievement(p_user_id, null, 'campaign_king') then newly := array_append(newly, 'campaign_king'); end if;
  end if;

  -- 13) last_minute – korrekter Live-Fund in der letzten Stunde vor Bild-Ablauf (unlocks_at + 24h)
  if exists (
    select 1 from player_attempts pa
    join event_images ei on ei.id = pa.image_id
    where pa.user_id = p_user_id and pa.is_correct
      and pa.attempted_at >= ei.unlocks_at + interval '23 hours'
      and pa.attempted_at <  ei.unlocks_at + interval '24 hours'
  ) then
    if unlock_achievement(p_user_id, null, 'last_minute') then newly := array_append(newly, 'last_minute'); end if;
  end if;

  return newly;
end;
$$;


-- =====================================================================
-- TEIL 4 – RANGLISTE: Achievement-Zahl global zählen
-- Die Reihenfolge der Spielwelt-Rangliste bleibt unverändert (nur Punkte);
-- nur die angezeigte "X Erfolge"-Zahl wird global statt pro Welt gezählt.
-- =====================================================================
drop function if exists world_leaderboard(uuid);
create function world_leaderboard(p_world_id uuid)
returns table(user_id uuid, username text, total_points bigint, wins bigint, achievement_count bigint, xp bigint)
language sql security definer as $$
  with points as (
    select user_id, sum(pts)::bigint as pts from (
      select pa.user_id, pa.points as pts
      from player_attempts pa
      join event_images ei on ei.id = pa.image_id and ei.world_id = p_world_id
      union all
      select cp.user_id, cp.points as pts
      from campaign_progress cp
      where cp.world_id = p_world_id
    ) z group by user_id
  ),
  achievements as (
    -- global pro Spieler, nicht mehr nach world_id gefiltert
    select user_id, count(*)::bigint as cnt
    from player_achievements
    group by user_id
  ),
  event_pts as (
    select ei.event_id, pa.user_id, sum(pa.points) as pts
    from player_attempts pa
    join event_images ei on ei.id = pa.image_id and ei.world_id = p_world_id
    join live_events le on le.id = ei.event_id and le.status = 'finished'
    group by ei.event_id, pa.user_id
  ),
  wins as (
    select user_id, count(*)::bigint as cnt from (
      select user_id, rank() over (partition by event_id order by pts desc) as rnk
      from event_pts where pts > 0
    ) r where rnk = 1 group by user_id
  )
  select
    p.id, p.username,
    coalesce(pt.pts, 0),
    coalesce(w.cnt, 0),
    coalesce(a.cnt, 0),
    p.global_xp::bigint
  from world_members wm
  join profiles p on p.id = wm.user_id
  left join points pt on pt.user_id = p.id
  left join achievements a on a.user_id = p.id
  left join wins w on w.user_id = p.id
  where wm.world_id = p_world_id and wm.role <> 'admin'   -- Admins nehmen in ihrer Welt nicht teil
  order by coalesce(pt.pts, 0) desc, p.global_xp desc;
$$;


-- =====================================================================
-- TEIL 5 – BACKFILL: fehlende Achievements (inkl. Tutorial) für alle
-- bestehenden Spieler nachtragen. Idempotent, keine doppelten XP/Gems.
-- =====================================================================
select p.username, recheck_achievements(p.id) as neu_vergeben
from profiles p
order by p.username;
