-- =============================================
-- WO IST...? – Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================

create extension if not exists "pgcrypto";

-- =============================================
-- SCHRITT 1: Alle Tabellen erstellen
-- =============================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  username_key text,
  avatar_url text,
  global_xp integer not null default 0,
  global_level integer not null default 1,
  global_wins integer not null default 0,
  created_at timestamptz not null default now()
);

-- Profilbild: öffentliche URL im bestehenden Bucket "game-images" (Ordner avatars/<uid>/)
alter table profiles add column if not exists avatar_url text;

-- Normalisierter Benutzername (getrimmt, einfache Leerzeichen, kleingeschrieben) für Eindeutigkeit/Login
alter table profiles add column if not exists username_key text;
update profiles set username_key = lower(regexp_replace(trim(username), '\s+', ' ', 'g')) where username_key is null;
create index if not exists profiles_username_key_idx on profiles (username_key);

-- Echte E-Mail privat (nur zur Wiederherstellung) – getrennt von öffentlich lesbaren Profilen
create table if not exists account_recovery (
  user_id uuid primary key references profiles(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
alter table account_recovery enable row level security;
create policy "Owner manages own recovery email" on account_recovery for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Prüft E-Mail-Eindeutigkeit, ohne fremde E-Mails offenzulegen
create or replace function email_taken(p_email text) returns boolean
language sql security definer as $$
  select exists(select 1 from account_recovery where lower(email) = lower(trim(p_email)));
$$;

create table worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  whatsapp_link text,
  join_code text unique not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Für bestehende Datenbanken (Spalten nachrüsten):
alter table worlds add column if not exists description text;
alter table worlds add column if not exists whatsapp_link text;

create table world_members (
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  certified boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

-- Zertifizierungs-Badge (pro Spielwelt)
alter table world_members add column if not exists certified boolean not null default false;

create table live_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'finished')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Globus-Standort (Pflichtfeld im Admin-Formular): Position des Events auf dem 3D-Globus.
-- Wird beim Archivieren zur Kampagne uebernommen (siehe finish_due_events).
alter table live_events add column if not exists latitude float8;
alter table live_events add column if not exists longitude float8;

create table event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references live_events(id) on delete cascade,
  world_id uuid references worlds(id) on delete cascade,
  image_url text not null,
  description text,
  unlocks_at timestamptz not null,
  sort_order integer not null default 0,
  target_x float8 not null default 0.5,
  target_y float8 not null default 0.5,
  target_radius float8 not null default 0.05,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table player_attempts (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references event_images(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  click_x float8 not null,
  click_y float8 not null,
  is_correct boolean not null,
  points integer not null default 0,
  time_seconds integer not null,
  attempted_at timestamptz not null default now(),
  unique (image_id, user_id)
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  title text not null,
  original_event_id uuid references live_events(id),
  is_legacy boolean not null default false,
  created_at timestamptz not null default now()
);

-- Globus-Standort der Kampagne (Pflichtfeld im Admin-Formular). Bei archivierten
-- Events aus dem Original-Event uebernommen (siehe finish_due_events).
alter table campaigns add column if not exists latitude float8;
alter table campaigns add column if not exists longitude float8;

-- Optionale Kampagnen-Beschreibung (max. 300 Zeichen, im Frontend erzwungen)
alter table campaigns add column if not exists description text;

-- Legacy-Kampagnen haben eigene Bilder (Event-Kampagnen nutzen die Bilder des Original-Events)
alter table event_images add column if not exists campaign_id uuid references campaigns(id) on delete cascade;

-- Optionale Bildbeschreibung (max. 300 Zeichen, im Frontend erzwungen)
alter table event_images add column if not exists description text;

-- Kampagnen-Fortschritt: getrennt von player_attempts, damit Live-Versuche unberührt bleiben.
-- Wiederholbar (found bleibt true), Punkte werden nur beim ersten Fund gesetzt.
create table campaign_progress (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  image_id uuid references event_images(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  world_id uuid references worlds(id) on delete cascade,
  found boolean not null default false,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, image_id, user_id)
);

create table player_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  world_id uuid references worlds(id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, world_id, achievement_key)
);

-- =============================================
-- SCHRITT 2: Row Level Security aktivieren
-- =============================================

alter table profiles enable row level security;
alter table worlds enable row level security;
alter table world_members enable row level security;
alter table live_events enable row level security;
alter table event_images enable row level security;
alter table player_attempts enable row level security;
alter table campaigns enable row level security;
alter table player_achievements enable row level security;
alter table campaign_progress enable row level security;

-- =============================================
-- SCHRITT 3: Policies (jetzt existieren alle Tabellen)
-- =============================================

-- profiles
create policy "Public profiles are viewable" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- worlds
create policy "Members can view their worlds" on worlds for select
  using (exists (select 1 from world_members where world_id = worlds.id and user_id = auth.uid()));
create policy "Authenticated users can create worlds" on worlds for insert
  with check (auth.uid() = created_by);
create policy "Admins can update their world" on worlds for update
  using (exists (select 1 from world_members where world_id = worlds.id and user_id = auth.uid() and role = 'admin'));

-- world_members
create policy "Members can view memberships" on world_members for select
  using (exists (select 1 from world_members wm where wm.world_id = world_members.world_id and wm.user_id = auth.uid()));
create policy "Users can insert own membership" on world_members for insert
  with check (auth.uid() = user_id);
create policy "Users can delete own membership" on world_members for delete
  using (auth.uid() = user_id);
create policy "Admins can delete any membership" on world_members for delete
  using (exists (select 1 from world_members wm where wm.world_id = world_members.world_id and wm.user_id = auth.uid() and wm.role = 'admin'));
-- using = nur Admins dürfen ändern; with check nur "Mitglied derselben Welt",
-- damit ein Admin sich auch selbst herabstufen kann (Rolle wird zu 'user').
create policy "Admins can update memberships" on world_members for update
  using (exists (select 1 from world_members wm where wm.world_id = world_members.world_id and wm.user_id = auth.uid() and wm.role = 'admin'))
  with check (exists (select 1 from world_members wm where wm.world_id = world_members.world_id and wm.user_id = auth.uid()));

-- Letzter Admin verlässt/wird entfernt -> Admin-Rolle automatisch ans dienstälteste Mitglied
create or replace function transfer_admin_if_last() returns trigger
language plpgsql security definer as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from world_members where world_id = old.world_id and role = 'admin'
  ) then
    update world_members set role = 'admin'
    where world_id = old.world_id
      and user_id = (
        select user_id from world_members where world_id = old.world_id
        order by joined_at asc limit 1
      );
  end if;
  return old;
end;
$$;
drop trigger if exists transfer_admin_after_delete on world_members;
create trigger transfer_admin_after_delete after delete on world_members
  for each row execute function transfer_admin_if_last();

-- live_events
create policy "Members can view events" on live_events for select
  using (exists (select 1 from world_members where world_id = live_events.world_id and user_id = auth.uid()));
create policy "Admins can manage events" on live_events for all
  using (exists (select 1 from world_members where world_id = live_events.world_id and user_id = auth.uid() and role = 'admin'));

-- event_images
create policy "Members can view images" on event_images for select
  using (exists (select 1 from world_members where world_id = event_images.world_id and user_id = auth.uid()));
create policy "Admins can manage images" on event_images for all
  using (exists (select 1 from world_members where world_id = event_images.world_id and user_id = auth.uid() and role = 'admin'));

-- player_attempts
create policy "Users can view own attempts" on player_attempts for select
  using (auth.uid() = user_id);
create policy "Users can insert own attempt" on player_attempts for insert
  with check (auth.uid() = user_id);
create policy "Admins can view all attempts" on player_attempts for select
  using (exists (
    select 1 from event_images ei
    join world_members wm on wm.world_id = ei.world_id
    where ei.id = player_attempts.image_id and wm.user_id = auth.uid() and wm.role = 'admin'
  ));

-- campaigns
create policy "Members can view campaigns" on campaigns for select
  using (exists (select 1 from world_members where world_id = campaigns.world_id and user_id = auth.uid()));
create policy "Admins can manage campaigns" on campaigns for all
  using (exists (select 1 from world_members where world_id = campaigns.world_id and user_id = auth.uid() and role = 'admin'));

-- campaign_progress: jeder verwaltet nur seinen eigenen Fortschritt
create policy "Users manage own campaign progress" on campaign_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- player_achievements
create policy "Users can view own achievements" on player_achievements for select
  using (auth.uid() = user_id);
create policy "Members can view achievements in world" on player_achievements for select
  using (exists (select 1 from world_members where world_id = player_achievements.world_id and user_id = auth.uid()));
create policy "System can insert achievements" on player_achievements for insert
  with check (auth.uid() = user_id);

-- =============================================
-- SCHRITT 4: Funktionen
-- =============================================

create or replace function add_xp(p_user_id uuid, p_xp integer, p_world_id uuid)
returns void language plpgsql security definer as $$
declare
  v_old integer;
  v_old_level integer;
  v_new_level integer;
  lvl integer;
begin
  select global_xp into v_old from profiles where id = p_user_id;
  update profiles set global_xp = global_xp + p_xp where id = p_user_id;
  -- Gems: 15 pro neu erreichtem Level (idempotent via award_gems)
  v_old_level := level_from_xp(v_old);
  v_new_level := level_from_xp(v_old + p_xp);
  if v_new_level > v_old_level then
    for lvl in (v_old_level + 1) .. v_new_level loop
      perform award_gems(p_user_id, 15, 'level_up', 'level_' || lvl);
    end loop;
  end if;
end;
$$;

-- Gibt true zurück, wenn das Achievement NEU freigeschaltet wurde (für das Banner)
create or replace function unlock_achievement(p_user_id uuid, p_world_id uuid, p_key text)
returns boolean language plpgsql security definer as $$
declare
  xp_rewards jsonb := '{
    "first_find": 100, "first_event": 100, "legacy_first": 150, "near_miss": 100,
    "eagle_eye": 500, "no_miss": 500, "patient_finder": 400, "streak_5": 600,
    "first_win": 1500, "perfect_event": 2500, "campaign_king": 1200, "last_minute": 1000
  }'::jsonb;
  -- Gems je Tier: Bronze 10, Silber 25, Gold 50
  gem_rewards jsonb := '{
    "first_find": 10, "first_event": 10, "legacy_first": 10, "near_miss": 10,
    "eagle_eye": 25, "no_miss": 25, "patient_finder": 25, "streak_5": 25,
    "first_win": 50, "perfect_event": 50, "campaign_king": 50, "last_minute": 50
  }'::jsonb;
  xp integer;
begin
  insert into player_achievements (user_id, world_id, achievement_key)
  values (p_user_id, p_world_id, p_key)
  on conflict (user_id, world_id, achievement_key) do nothing;

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

-- Siege = beendete Live-Events, in denen der Spieler die meisten Punkte hatte.
-- Punkte = Summe aller player_attempts.points (Live-Events + Kampagnen).
-- Level wird im Frontend aus xp (global_xp) berechnet.

-- Rangliste pro Spielwelt
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
    select user_id, count(*)::bigint as cnt
    from player_achievements
    where world_id = p_world_id
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

-- Globale Rangliste (über alle Spielwelten)
drop function if exists global_leaderboard();
create function global_leaderboard()
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
    coalesce(pt.pts, 0),
    coalesce(w.cnt, 0),
    coalesce(a.cnt, 0),
    p.global_xp::bigint
  from profiles p
  left join points pt on pt.user_id = p.id
  left join achievements a on a.user_id = p.id
  left join wins w on w.user_id = p.id
  order by coalesce(pt.pts, 0) desc, p.global_xp desc
  limit 100;
$$;

-- Aggregierte Spielstatistik eines Nutzers (für fremde Profilseiten – nur Zählwerte, keine sensiblen Daten)
create or replace function user_play_stats(p_user_id uuid)
returns table(total bigint, finds bigint)
language sql security definer as $$
  select count(*)::bigint, count(*) filter (where is_correct)::bigint
  from player_attempts where user_id = p_user_id;
$$;

-- Rangliste pro Live-Event (nur Punkte aus den Bildern dieses Events)
create or replace function event_leaderboard(p_event_id uuid)
returns table(user_id uuid, username text, total_points bigint, finds bigint, xp bigint)
language sql security definer as $$
  select
    p.id, p.username,
    coalesce(sum(pa.points), 0)::bigint as total_points,
    count(*) filter (where pa.is_correct)::bigint as finds,
    p.global_xp::bigint as xp
  from player_attempts pa
  join event_images ei on ei.id = pa.image_id and ei.event_id = p_event_id
  join profiles p on p.id = pa.user_id
  where not exists (   -- Admins der Welt tauchen nicht in der Event-Rangliste auf
    select 1 from world_members wm
    where wm.world_id = ei.world_id and wm.user_id = pa.user_id and wm.role = 'admin'
  )
  group by p.id, p.username, p.global_xp
  order by total_points desc;
$$;

create or replace function join_world(p_user_id uuid, p_join_code text)
returns uuid
language plpgsql security definer as $$
declare
  v_world_id uuid;
begin
  select worlds.id into v_world_id from worlds where worlds.join_code = upper(p_join_code);

  if v_world_id is null then
    raise exception 'INVALID_CODE';
  end if;

  if exists(select 1 from world_members where world_id = v_world_id and user_id = p_user_id) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into world_members (world_id, user_id, role) values (v_world_id, p_user_id, 'user');

  return v_world_id;
end;
$$;

-- Rolle eines Mitglieds ändern (nur durch Welt-Admins). Bei Beförderung zum Admin
-- werden ALLE in dieser Welt gesammelten Spieldaten des Nutzers gelöscht -> Start bei 0,
-- falls er je wieder degradiert wird. Admins nehmen in ihrer Welt nicht als Spieler teil.
create or replace function set_member_role(p_world_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer as $$
declare v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_role not in ('admin', 'user') then raise exception 'BAD_ROLE'; end if;
  if not exists (select 1 from world_members where world_id = p_world_id and user_id = v_caller and role = 'admin') then
    raise exception 'NOT_ADMIN';
  end if;

  update world_members set role = p_role where world_id = p_world_id and user_id = p_user_id;

  if p_role = 'admin' then
    -- Punkte + Spieldaten dieser Welt löschen (er startet bei 0, keine Wiederherstellung)
    delete from player_attempts pa using event_images ei
      where pa.image_id = ei.id and ei.world_id = p_world_id and pa.user_id = p_user_id;
    delete from campaign_progress where world_id = p_world_id and user_id = p_user_id;
    delete from image_item_log iil using event_images ei
      where iil.image_id = ei.id and ei.world_id = p_world_id and iil.player_id = p_user_id;
    delete from player_image_items pii using event_images ei
      where pii.image_id = ei.id and ei.world_id = p_world_id and pii.player_id = p_user_id;
    delete from debuffs d using event_images ei
      where d.image_id = ei.id and ei.world_id = p_world_id
        and (d.sender_id = p_user_id or d.target_player_id = p_user_id);
  end if;
end;
$$;

-- Spielerergebnisse eines (Legacy-)Kampagnen-Bildes für die Admin-Ansicht.
-- Security-Definer, weil campaign_progress per RLS nur eigene Zeilen zeigt. Nur Welt-Admins.
create or replace function campaign_image_players(p_campaign_id uuid, p_image_id uuid)
returns table (user_id uuid, found boolean, points integer, username text, avatar_url text, equipped_frame text)
language plpgsql security definer as $$
declare v_caller uuid := auth.uid(); v_world uuid;
begin
  select world_id into v_world from campaigns where id = p_campaign_id;
  if v_world is null then return; end if;
  if not exists (select 1 from world_members wm where wm.world_id = v_world and wm.user_id = v_caller and wm.role = 'admin') then
    return;
  end if;
  return query
    select cp.user_id, cp.found, cp.points, p.username, p.avatar_url, p.equipped_frame
    from campaign_progress cp
    join profiles p on p.id = cp.user_id
    where cp.campaign_id = p_campaign_id and cp.image_id = p_image_id
    order by cp.found desc, cp.points desc;
end;
$$;

-- =============================================
-- SCHRITT 5: Storage-Policies
-- (Bucket "game-images" muss vorher im Dashboard erstellt werden)
-- =============================================

create policy "Public images are viewable" on storage.objects for select
  using (bucket_id = 'game-images');
create policy "Authenticated users can upload" on storage.objects for insert
  with check (bucket_id = 'game-images' and auth.role() = 'authenticated');
create policy "Authenticated users can delete own uploads" on storage.objects for delete
  using (bucket_id = 'game-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- SCHRITT 6: Live-Events automatisch beenden + Ergebnis-Bestätigung
-- =============================================

-- Merkt sich, dass ein Spieler das Ergebnis eines beendeten Events bestätigt hat
-- (dann verschwindet das Ergebnis-Banner auf der Spielwelt-Startseite).
create table if not exists event_result_ack (
  user_id uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references live_events(id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table event_result_ack enable row level security;
create policy "own acks select" on event_result_ack for select using (auth.uid() = user_id);
create policy "own acks insert" on event_result_ack for insert with check (auth.uid() = user_id);

-- Beendet + archiviert aktive Events, deren letzter Tag UND die 24h-Frist des letzten
-- Bildes abgelaufen sind. Security-Definer: jedes Mitglied darf es (beim Laden) auslösen.
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

-- =============================================
-- SCHRITT 7: Tutorial (global, keine Spielwelt)
-- =============================================

-- Merkt pro Spieler, ob das Tutorial abgeschlossen wurde (Haken am Button + einmaliges Achievement)
alter table profiles add column if not exists tutorial_completed boolean not null default false;

-- Schließt das Tutorial ab: setzt das Flag und vergibt das globale Achievement
-- "tutorial_master" (150 XP) genau einmal. Gibt true zurück, wenn neu vergeben (fürs Banner).
create or replace function complete_tutorial(p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_first boolean;
begin
  select not coalesce(tutorial_completed, false) into v_first from profiles where id = p_user_id;
  update profiles set tutorial_completed = true where id = p_user_id;
  if v_first and not exists (
    select 1 from player_achievements where user_id = p_user_id and achievement_key = 'tutorial_master'
  ) then
    insert into player_achievements (user_id, world_id, achievement_key)
    values (p_user_id, null, 'tutorial_master');
    perform add_xp(p_user_id, 150, null);
    perform award_gems(p_user_id, 10, 'achievement', 'tutorial_master'); -- Bronze
    return true;
  end if;
  return false;
end;
$$;

-- =============================================
-- SCHRITT 8: Gems (Währung) – Phase 1
-- Gems sind knapp und nur durch Spielen verdienbar. Alle Vergaben laufen
-- serverseitig + idempotent über ein Ledger; das Frontend schreibt nie direkt.
-- =============================================

alter table profiles add column if not exists gems integer not null default 0;

-- Ledger: macht jede Gem-Vergabe eindeutig (idempotent) und nachvollziehbar
create table if not exists gem_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  ref_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_key)
);
alter table gem_transactions enable row level security;
create policy "own gem transactions" on gem_transactions for select using (auth.uid() = user_id);

-- Zentrale, idempotente Gem-Vergabe. NICHT direkt vom Frontend aufrufbar (revoke unten) –
-- nur die validierenden Security-Definer-Funktionen dürfen sie (als Owner) aufrufen.
create or replace function award_gems(p_user_id uuid, p_amount integer, p_reason text, p_ref_key text)
returns integer language plpgsql security definer as $$
begin
  if p_amount <= 0 then return 0; end if;
  insert into gem_transactions (user_id, amount, reason, ref_key)
  values (p_user_id, p_amount, p_reason, p_ref_key)
  on conflict (user_id, reason, ref_key) do nothing;
  if not found then return 0; end if; -- schon vergeben -> nichts tun
  update profiles set gems = gems + p_amount where id = p_user_id;
  return p_amount;
end;
$$;
revoke execute on function award_gems(uuid, integer, text, text) from public, anon, authenticated;

-- Level aus XP – gleiche Formel wie im Frontend: round(300 * level^1.2)
create or replace function level_from_xp(p_xp integer)
returns integer language plpgsql immutable as $$
declare
  lvl integer := 1;
  remaining integer := p_xp;
  needed integer;
begin
  loop
    needed := round(300 * power(lvl, 1.2));
    if remaining < needed then return lvl; end if;
    remaining := remaining - needed;
    lvl := lvl + 1;
  end loop;
end;
$$;

-- 5 Gems für einen korrekten Live-Event-Treffer (nur wenn wirklich getroffen; einmal pro Bild)
create or replace function award_find_gems(p_user_id uuid, p_image_id uuid)
returns integer language plpgsql security definer as $$
begin
  if not exists (
    select 1 from player_attempts
    where user_id = p_user_id and image_id = p_image_id and is_correct
  ) then
    return 0;
  end if;
  return award_gems(p_user_id, 5, 'find', p_image_id::text);
end;
$$;

-- 20 Gems wenn eine Kampagne KOMPLETT abgeschlossen ist (einmal pro Kampagne, nicht beim Wiederholen)
create or replace function award_campaign_gems(p_user_id uuid, p_campaign_id uuid)
returns integer language plpgsql security definer as $$
declare
  v_event uuid;
  v_total integer;
  v_done integer;
begin
  select original_event_id into v_event from campaigns where id = p_campaign_id;
  with imgs as (
    select ei.id from event_images ei
    where (v_event is not null and ei.event_id = v_event)
       or (v_event is null and ei.campaign_id = p_campaign_id)
  ),
  done as (
    select i.id from imgs i
    where exists (select 1 from campaign_progress cp
                  where cp.campaign_id = p_campaign_id and cp.image_id = i.id
                    and cp.user_id = p_user_id and cp.found)
       or exists (select 1 from player_attempts pa
                  where pa.image_id = i.id and pa.user_id = p_user_id and pa.is_correct)
  )
  select (select count(*) from imgs), (select count(*) from done) into v_total, v_done;
  if v_total = 0 or v_done < v_total then return 0; end if;
  return award_gems(p_user_id, 20, 'campaign', p_campaign_id::text);
end;
$$;

-- =============================================
-- SCHRITT 9: Shop / Inventar – Phase 2
-- =============================================

-- Gekaufte Items pro Spieler (stapelbar über quantity)
create table if not exists player_inventory (
  player_id uuid not null references profiles(id) on delete cascade,
  item_key text not null,
  quantity integer not null default 0,
  primary key (player_id, item_key)
);
alter table player_inventory enable row level security;
create policy "own inventory select" on player_inventory for select using (auth.uid() = player_id);

-- Kauf eines Items: prüft + zieht Gems ATOMAR ab und legt das Item ins Inventar.
-- Preis liegt serverseitig (nicht fälschbar). Nutzt auth.uid() statt eines Parameters,
-- damit niemand für fremde Konten kaufen kann. Fehler: NOT_ENOUGH_GEMS / UNKNOWN_ITEM.
create or replace function buy_item(p_item_key text)
returns integer language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  -- Server-autoritative Preise (müssen mit src/lib/shop.ts übereinstimmen)
  prices jsonb := '{
    "magnifier": 150, "double_points": 220, "slow_motion": 280,
    "timer_debuff": 180, "blur_debuff": 180
  }'::jsonb;
  v_price integer;
  v_qty integer;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  v_price := (prices ->> p_item_key)::integer;
  if v_price is null then raise exception 'UNKNOWN_ITEM'; end if;

  -- Nur abziehen, wenn genug Gems da sind (atomar in einer Anweisung)
  update profiles set gems = gems - v_price where id = v_user and gems >= v_price;
  if not found then raise exception 'NOT_ENOUGH_GEMS'; end if;

  insert into player_inventory (player_id, item_key, quantity)
  values (v_user, p_item_key, 1)
  on conflict (player_id, item_key) do update set quantity = player_inventory.quantity + 1
  returning quantity into v_qty;
  return v_qty;
end;
$$;

-- =============================================
-- SCHRITT 10: Item-Einsatz im Live-Event – Phase 4
-- Vor-Runden-Items werden beim Tippen auf "Spielen" scharf gestellt (abgezogen),
-- Debuffs nur auf noch gesperrte Bilder gegen Spieler, die noch nicht gespielt haben.
-- Alles serverseitig + validiert; das Frontend zieht nie selbst Items/Gems ab.
-- =============================================

-- Scharf gestellte Vor-Runden-Items pro Spieler und Bild (double_points, slow_motion).
-- Effekte selbst kommen in Phase 5 – hier wird nur der Einsatz verbucht.
create table if not exists player_image_items (
  player_id uuid not null references profiles(id) on delete cascade,
  image_id uuid not null references event_images(id) on delete cascade,
  item_key text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, image_id, item_key)
);
alter table player_image_items enable row level security;
create policy "own image items select" on player_image_items for select using (auth.uid() = player_id);

-- Debuffs, die ein Spieler auf das (noch gesperrte) Bild eines anderen legt.
create table if not exists debuffs (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  target_player_id uuid not null references profiles(id) on delete cascade,
  image_id uuid not null references event_images(id) on delete cascade,
  debuff_type text not null,               -- 'timer_debuff' | 'blur_debuff'
  stacks integer not null default 1,
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sender_id, target_player_id, image_id, debuff_type)
);
alter table debuffs enable row level security;
-- Sichtbar für Absender (was habe ich verschickt) und Ziel (was liegt auf mir)
create policy "sender or target views debuff" on debuffs for select
  using (auth.uid() = sender_id or auth.uid() = target_player_id);

-- Stellt Vor-Runden-Items für ein freigeschaltetes, noch nicht gespieltes Bild scharf.
-- Zieht jedes Item genau einmal aus dem Inventar ab (idempotent: bereits scharf gestellte
-- Items werden nicht erneut abgezogen, falls der Spieler zurückgeht und neu "Spielen" tippt).
create or replace function arm_pre_round_items(p_image_id uuid, p_item_keys text[])
returns void language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_pre text[] := array['double_points', 'slow_motion'];
  v_buffs integer;   -- Anzahl bereits scharf gestellter Buffs für dieses Bild
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from event_images where id = p_image_id and unlocks_at <= now()) then
    raise exception 'IMAGE_LOCKED';
  end if;
  if exists (select 1 from player_attempts where image_id = p_image_id and user_id = v_user) then
    raise exception 'ALREADY_PLAYED';
  end if;

  select count(*) into v_buffs from player_image_items
  where player_id = v_user and image_id = p_image_id and item_key = any(v_pre);

  foreach v_key in array coalesce(p_item_keys, '{}'::text[]) loop
    if not (v_key = any(v_pre)) then continue; end if;                    -- nur Vor-Runden-Items
    -- schon scharf gestellt? -> nicht erneut abziehen
    if exists (select 1 from player_image_items
               where player_id = v_user and image_id = p_image_id and item_key = v_key) then
      continue;
    end if;
    if v_buffs >= 1 then raise exception 'TOO_MANY_BUFFS'; end if;        -- nur EIN Buff pro Bild
    update player_inventory set quantity = quantity - 1
      where player_id = v_user and item_key = v_key and quantity > 0;
    if not found then raise exception 'NOT_OWNED:%', v_key; end if;
    insert into player_image_items (player_id, image_id, item_key) values (v_user, p_image_id, v_key);
    v_buffs := v_buffs + 1;
  end loop;
end;
$$;

-- Setzt einen Debuff gegen einen Zielspieler auf ein noch gesperrtes Bild.
-- Prüft: Bild noch gesperrt, Ziel ist Mitglied derselben Welt und hat noch nicht gespielt,
-- Absender besitzt das Debuff-Item. Zieht das Item ab.
-- Regel: EIN Debuff pro Absender, Bild und Zielspieler (kein Mehrfach-Vergeben).
-- Verschiedene Absender stapeln (mehrere Zeilen) – wird in Phase 5 summiert.
create or replace function cast_debuff(p_image_id uuid, p_target_player_id uuid, p_debuff_type text)
returns void language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_world uuid;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_debuff_type not in ('timer_debuff', 'blur_debuff') then raise exception 'UNKNOWN_DEBUFF'; end if;
  if p_target_player_id = v_user then raise exception 'NO_SELF_TARGET'; end if;

  select coalesce(ei.world_id, le.world_id) into v_world
  from event_images ei left join live_events le on le.id = ei.event_id
  where ei.id = p_image_id and ei.unlocks_at > now();     -- Bild muss noch gesperrt sein
  if v_world is null then raise exception 'IMAGE_NOT_LOCKED'; end if;

  if not exists (select 1 from world_members wm where wm.world_id = v_world and wm.user_id = v_user) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if not exists (select 1 from world_members wm where wm.world_id = v_world and wm.user_id = p_target_player_id) then
    raise exception 'TARGET_NOT_MEMBER';
  end if;
  if exists (select 1 from player_attempts where image_id = p_image_id and user_id = p_target_player_id) then
    raise exception 'TARGET_ALREADY_PLAYED';
  end if;
  -- Schon einen Debuff auf diesen Spieler für dieses Bild vergeben? -> kein zweiter
  if exists (select 1 from debuffs
             where sender_id = v_user and image_id = p_image_id and target_player_id = p_target_player_id) then
    raise exception 'ALREADY_CAST';
  end if;

  update player_inventory set quantity = quantity - 1
    where player_id = v_user and item_key = p_debuff_type and quantity > 0;
  if not found then raise exception 'NOT_OWNED'; end if;

  insert into debuffs (sender_id, target_player_id, image_id, debuff_type, stacks)
  values (v_user, p_target_player_id, p_image_id, p_debuff_type, 1);
end;
$$;

-- Debuffs, die ICH auf ein Bild vergeben habe – inkl. Zielspieler-Name.
-- Für die Anzeige "Von dir vergeben" + zum Ausblenden bereits getroffener Ziele.
create or replace function my_sent_debuffs(p_image_id uuid)
returns table (debuff_type text, target_player_id uuid, target_username text)
language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  return query
    select d.debuff_type, d.target_player_id, p.username
    from debuffs d join profiles p on p.id = d.target_player_id
    where d.image_id = p_image_id and d.sender_id = v_user
    order by d.created_at;
end;
$$;

-- Mögliche Debuff-Ziele für ein Bild: Mitglieder derselben Welt (außer mir),
-- die dieses Bild noch NICHT gespielt haben. Liefert je Kandidat die bereits auf ihm
-- liegenden Debuffs (aggregiert über ALLE Absender) mit, damit man sieht, wer schon
-- was hat. Security-Definer, weil player_attempts + fremde Debuffs sonst nicht lesbar sind.
create or replace function image_debuff_targets(p_image_id uuid)
returns table (user_id uuid, username text, avatar_url text, active_debuffs jsonb)
language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_world uuid;
begin
  select coalesce(ei.world_id, le.world_id) into v_world
  from event_images ei left join live_events le on le.id = ei.event_id
  where ei.id = p_image_id;
  if v_world is null then return; end if;
  -- wm-Alias + qualifizierte Spalten: sonst kollidiert user_id mit der gleichnamigen OUT-Spalte.
  if not exists (select 1 from world_members wm where wm.world_id = v_world and wm.user_id = v_user) then return; end if;

  return query
    select p.id, p.username, p.avatar_url,
      coalesce((
        select jsonb_agg(jsonb_build_object('debuff_type', t.debuff_type, 'stacks', t.total) order by t.debuff_type)
        from (
          select d.debuff_type, sum(d.stacks)::int as total
          from debuffs d
          where d.image_id = p_image_id and d.target_player_id = p.id
          group by d.debuff_type
        ) t
      ), '[]'::jsonb)
    from world_members wm
    join profiles p on p.id = wm.user_id
    where wm.world_id = v_world
      and wm.user_id <> v_user
      and not exists (select 1 from player_attempts pa
                      where pa.image_id = p_image_id and pa.user_id = wm.user_id)
    order by p.username;
end;
$$;

-- Debuffs, die auf MIR für ein Bild liegen – inkl. Absender-Name (für den "bereits gespielt"-Zustand).
create or replace function my_image_debuffs(p_image_id uuid)
returns table (debuff_type text, stacks integer, sender_username text)
language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  return query
    select d.debuff_type, d.stacks, p.username
    from debuffs d join profiles p on p.id = d.sender_id
    where d.image_id = p_image_id and d.target_player_id = v_user
    order by d.created_at;
end;
$$;

-- =============================================
-- SCHRITT 11: Lupe (Während-Runden-Item) – Phase 6
-- =============================================

-- Setzt die Lupe für ein Bild ein: zieht atomar EINE Lupe ab und merkt den Einsatz
-- in player_image_items (erzwingt "nur einmal pro Bild", auch bei mehreren im Inventar).
create or replace function use_magnifier(p_image_id uuid)
returns void language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from event_images where id = p_image_id and unlocks_at <= now()) then
    raise exception 'IMAGE_LOCKED';
  end if;
  if exists (select 1 from player_attempts where image_id = p_image_id and user_id = v_user) then
    raise exception 'ALREADY_PLAYED';
  end if;
  if exists (select 1 from player_image_items
             where player_id = v_user and image_id = p_image_id and item_key = 'magnifier') then
    raise exception 'ALREADY_USED';
  end if;
  update player_inventory set quantity = quantity - 1
    where player_id = v_user and item_key = 'magnifier' and quantity > 0;
  if not found then raise exception 'NOT_OWNED'; end if;
  insert into player_image_items (player_id, image_id, item_key) values (v_user, p_image_id, 'magnifier');
end;
$$;

-- =============================================
-- SCHRITT 12: Item-Log für die Rangliste – Phase 7
-- =============================================

-- Pro Spieler und Bild: welche Items er selbst eingesetzt hat und welche Debuffs auf ihm lagen.
-- Wird beim Abschluss eines Bildes geschrieben (Snapshot für die Ranglisten-Anzeige).
create table if not exists image_item_log (
  player_id uuid not null references profiles(id) on delete cascade,
  image_id uuid not null references event_images(id) on delete cascade,
  items_used text[] not null default '{}',        -- z. B. {magnifier,double_points}
  debuffs_received jsonb not null default '[]',    -- [{debuff_type, stacks, sender}]
  created_at timestamptz not null default now(),
  primary key (player_id, image_id)
);
alter table image_item_log enable row level security;
create policy "own item log select" on image_item_log for select using (auth.uid() = player_id);

-- Schreibt den Log-Eintrag des aufrufenden Spielers für ein Bild (aus player_image_items + debuffs).
-- Nur wenn der Spieler das Bild wirklich gespielt hat. Idempotent (upsert).
create or replace function log_image_items(p_image_id uuid)
returns void language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_items text[];
  v_debuffs jsonb;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from player_attempts where image_id = p_image_id and user_id = v_user) then
    return;
  end if;

  select coalesce(array_agg(item_key order by item_key), '{}')
  into v_items
  from player_image_items
  where player_id = v_user and image_id = p_image_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'debuff_type', d.debuff_type, 'stacks', d.stacks, 'sender', p.username
         ) order by d.created_at), '[]'::jsonb)
  into v_debuffs
  from debuffs d join profiles p on p.id = d.sender_id
  where d.image_id = p_image_id and d.target_player_id = v_user;

  insert into image_item_log (player_id, image_id, items_used, debuffs_received)
  values (v_user, p_image_id, v_items, v_debuffs)
  on conflict (player_id, image_id) do update
    set items_used = excluded.items_used,
        debuffs_received = excluded.debuffs_received,
        created_at = now();
end;
$$;

-- Item-Logs aller Spieler für ein Event (roh, eine Zeile pro Spieler+Bild).
-- Aggregation (Zählen/Absender sammeln) macht das Frontend. Nur für Welt-Mitglieder.
create or replace function event_item_log(p_event_id uuid)
returns table (user_id uuid, items_used text[], debuffs_received jsonb)
language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if not exists (
    select 1 from live_events le join world_members wm on wm.world_id = le.world_id
    where le.id = p_event_id and wm.user_id = v_user
  ) then return; end if;

  return query
    select l.player_id, l.items_used, l.debuffs_received
    from image_item_log l
    join event_images ei on ei.id = l.image_id
    where ei.event_id = p_event_id;
end;
$$;

-- =============================================
-- SCHRITT 13: Cosmetics – Profilbild-Rahmen – Phase 8
-- Währung = Gems. Seltenheiten: Selten / Episch / Legendär.
-- =============================================

alter table profiles add column if not exists equipped_frame text;

-- Katalog aller kaufbaren Rahmen (id = FrameType im Frontend)
create table if not exists frames (
  id text primary key,
  name text not null,
  rarity text not null,
  price int not null check (price >= 0),
  active boolean not null default true
);

-- equipped_frame darf nur auf einen existierenden Rahmen zeigen
alter table profiles drop constraint if exists profiles_equipped_frame_fkey;
alter table profiles add constraint profiles_equipped_frame_fkey
  foreign key (equipped_frame) references frames(id) on delete set null;

-- Besitz: welcher Spieler besitzt welchen Rahmen
create table if not exists user_frames (
  user_id uuid not null references profiles(id) on delete cascade,
  frame_id text not null references frames(id) on delete cascade,
  acquired_at timestamptz default now(),
  primary key (user_id, frame_id)
);

-- Seed (Gems-Preise, drei Seltenheiten). Muss mit src/lib/frames.ts übereinstimmen.
insert into frames (id, name, rarity, price) values
  ('stars',    'Sternenreigen',  'Selten',    50),
  ('sparkle',  'Funkelstaub',    'Selten',    50),
  ('snow',     'Schneegestöber', 'Selten',    50),
  ('confetti', 'Party-Regen',    'Selten',    50),
  ('hearts',   'Herzenkranz',    'Selten',    50),
  ('pulse',    'Herzschlag',     'Episch',   150),
  ('beer',     'Prost!',         'Legendär', 550),
  ('aurora',   'Polarlicht',     'Legendär', 550),
  ('fire',     'Feuersturm',     'Legendär', 550)
on conflict (id) do update
  set name = excluded.name, rarity = excluded.rarity, price = excluded.price, active = true;

-- Kauf: Gems atomar prüfen + abziehen, Besitz eintragen. Preis serverseitig (nicht fälschbar).
create or replace function buy_frame(p_frame_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_price int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select price into v_price from frames where id = p_frame_id and active;
  if not found then raise exception 'UNKNOWN_FRAME'; end if;
  if exists (select 1 from user_frames where user_id = v_uid and frame_id = p_frame_id) then
    return; -- schon im Besitz -> kein zweiter Abzug
  end if;
  update profiles set gems = gems - v_price where id = v_uid and gems >= v_price;
  if not found then raise exception 'NOT_ENOUGH_GEMS'; end if;
  insert into user_frames (user_id, frame_id) values (v_uid, p_frame_id);
end;
$$;

-- Rahmen ausrüsten (nur wenn im Besitz); p_frame_id = null -> Rahmen ablegen.
create or replace function equip_frame(p_frame_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_frame_id is not null and not exists (
    select 1 from user_frames where user_id = v_uid and frame_id = p_frame_id
  ) then raise exception 'FRAME_NOT_OWNED'; end if;
  update profiles set equipped_frame = p_frame_id where id = v_uid;
end;
$$;

alter table frames enable row level security;
alter table user_frames enable row level security;
drop policy if exists frames_read on frames;
create policy frames_read on frames for select using (true);
drop policy if exists user_frames_read on user_frames;
create policy user_frames_read on user_frames for select using (true);
-- Kein INSERT/UPDATE-Policy -> direktes Schreiben blockiert; Kauf/Ausrüsten nur über die RPCs.
