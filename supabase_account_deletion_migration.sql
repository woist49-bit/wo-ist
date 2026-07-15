-- =============================================
-- Account-Loeschung ermoeglichen + Punkte beim Loeschen einer Welt erhalten
-- In Supabase (SQL-Editor) einmal komplett ausfuehren.
-- Laeuft in EINER Transaktion: bricht etwas ab, ist NICHTS veraendert.
-- Idempotent: kann gefahrlos mehrfach laufen.
-- =============================================

-- ---------------------------------------------
-- TEIL 1: Fremdschluessel auf SET NULL
-- Diese drei Spalten zeigten ohne on-delete-Regel auf profiles -> Default ist NO ACTION.
-- Das Loeschen eines Accounts, der je eine Welt/ein Event erstellt oder ein Bild
-- hochgeladen hat, brach damit mit einem Fremdschluessel-Fehler ab.
-- Jetzt: Inhalte bleiben vollstaendig erhalten, nur die Urheberschaft wird leer.
-- Alle drei Spalten sind bereits nullable.
-- ---------------------------------------------
alter table worlds drop constraint if exists worlds_created_by_fkey;
alter table worlds add constraint worlds_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table live_events drop constraint if exists live_events_created_by_fkey;
alter table live_events add constraint live_events_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table event_images drop constraint if exists event_images_uploaded_by_fkey;
alter table event_images add constraint event_images_uploaded_by_fkey
  foreign key (uploaded_by) references profiles(id) on delete set null;

-- ---------------------------------------------
-- TEIL 2: Admin-Nachfolge beim Account-Loeschen
-- KEIN CODE NOETIG. Der bestehende Trigger transfer_admin_after_delete haengt an
-- world_members (after delete for each row), nicht am "Spielwelt verlassen"-Button.
-- Beim Loeschen eines Accounts raeumt die Cascade profiles -> world_members dessen
-- Mitgliedschaft ab, und Cascade-Loeschungen feuern Row-Trigger ganz normal.
-- Die Nachfolge (dienstaeltestes Mitglied nach joined_at) greift also von selbst.
-- Hier nur zur Sicherheit nachgezogen, falls der Trigger mal verlorenging:
-- ---------------------------------------------
drop trigger if exists transfer_admin_after_delete on world_members;
create trigger transfer_admin_after_delete after delete on world_members
  for each row execute function transfer_admin_if_last();

-- ---------------------------------------------
-- TEIL 3: Punkte ueberleben das Loeschen ihrer Spielwelt
-- Punkte liegen pro Zeile in player_attempts/campaign_progress und haengen ueber
-- Bild -> Event -> Welt an der Spielwelt. Beim Loeschen der Welt faellt die ganze
-- Kette. Verdient sind sie trotzdem -> vorher aufsummieren und ans Profil haengen.
-- ---------------------------------------------
alter table profiles add column if not exists legacy_points bigint not null default 0;

-- BEFORE DELETE auf worlds: Fremdschluessel-Aktionen (die Cascade) laufen erst NACH
-- dem Loeschen der Zeile - hier existieren die Punkte also noch.
-- security definer: laeuft als Owner, deshalb weder von RLS noch von den
-- Spalten-Grants auf profiles betroffen (legacy_points ist fuer Clients nicht schreibbar).
create or replace function keep_points_on_world_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  with pts as (
    -- Live-Punkte: ueber das Bild an der Welt
    select pa.user_id, pa.points as p
    from player_attempts pa
    join event_images ei on ei.id = pa.image_id
    where ei.world_id = old.id
    union all
    -- Kampagnen-Punkte: haengen direkt an der Welt
    select cp.user_id, cp.points
    from campaign_progress cp
    where cp.world_id = old.id
  ),
  agg as (
    select user_id, sum(p)::bigint as total from pts group by user_id
  )
  update profiles pr
  set legacy_points = pr.legacy_points + agg.total
  from agg
  where pr.id = agg.user_id and agg.total > 0;
  return old;
end;
$$;

drop trigger if exists keep_points_before_world_delete on worlds;
create trigger keep_points_before_world_delete
  before delete on worlds
  for each row execute function keep_points_on_world_delete();

-- Gesamtpunkte eines Spielers: bestehende Welten + geerbte Punkte geloeschter Welten.
create or replace function user_totals(p_user_id uuid)
returns table(total_points bigint, wins bigint)
language sql security definer as $$
  select
    (coalesce((select sum(points) from player_attempts where user_id = p_user_id), 0)
     + coalesce((select sum(points) from campaign_progress where user_id = p_user_id), 0)
     + coalesce((select legacy_points from profiles where id = p_user_id), 0))::bigint,
    -- Siege haengen strukturell an der Event-Historie und gehen mit der Welt verloren.
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

-- Globale Rangliste rechnet die Punkte selbst aus -> legacy_points auch hier dazu,
-- sonst zeigt das Profil eine andere Zahl als die Rangliste.
create or replace function global_leaderboard()
returns table(user_id uuid, username text, total_points bigint, wins bigint, achievement_count bigint, xp bigint)
language sql security definer as $$
  with points as (
    select user_id, sum(pts)::bigint as pts from (
      select pa.user_id, pa.points as pts from player_attempts pa
      union all
      select cp.user_id, cp.points as pts from campaign_progress cp
    ) z group by user_id
  ),
  achievements as (
    select user_id, count(*)::bigint as cnt
    from player_achievements
    group by user_id
  ),
  event_pts as (
    select ei.event_id, pa.user_id, sum(pa.points) as pts
    from player_attempts pa
    join event_images ei on ei.id = pa.image_id
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
    (coalesce(pt.pts, 0) + p.legacy_points)::bigint,
    coalesce(w.cnt, 0),
    coalesce(a.cnt, 0),
    p.global_xp::bigint
  from profiles p
  left join points pt on pt.user_id = p.id
  left join achievements a on a.user_id = p.id
  left join wins w on w.user_id = p.id
  order by (coalesce(pt.pts, 0) + p.legacy_points) desc, p.global_xp desc
  limit 100;
$$;

-- =============================================
-- KONTROLLE (nach dem Lauf, aendert nichts)
-- =============================================
-- 1) Die drei Fremdschluessel muessen jetzt SET NULL sein (Erwartung: 3 Zeilen, alle 'n'):
-- select tc.table_name, kcu.column_name, rc.delete_rule
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
-- join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
-- where tc.constraint_name in ('worlds_created_by_fkey', 'live_events_created_by_fkey', 'event_images_uploaded_by_fkey');
--
-- 2) Geerbte Punkte je Spieler (nach dem Loeschen einer Welt):
-- select username, legacy_points from profiles where legacy_points > 0 order by legacy_points desc;
--
-- 3) Welten ohne Ersteller (nach Account-Loeschungen normal) bzw. ohne Admin (Sonderfall,
--    tritt nur auf, wenn der geloeschte Account das EINZIGE Mitglied war):
-- select w.name, (w.created_by is null) as ersteller_geloescht,
--        (select count(*) from world_members wm where wm.world_id = w.id and wm.role = 'admin') as admins,
--        (select count(*) from world_members wm where wm.world_id = w.id) as mitglieder
-- from worlds w order by admins, mitglieder;
