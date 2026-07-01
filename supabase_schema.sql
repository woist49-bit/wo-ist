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
begin
  update profiles set global_xp = global_xp + p_xp where id = p_user_id;
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
      and pa.attempted_at <= ei.unlocks_at + interval '24 hours'
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
  where wm.world_id = p_world_id
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
      and pa.attempted_at <= ei.unlocks_at + interval '24 hours'
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
    and pa.attempted_at <= ei.unlocks_at + interval '24 hours'
  join profiles p on p.id = pa.user_id
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
    -- Frist = spätestes Bild-Freischalten + 24h, mindestens aber das Event-Enddatum
    select greatest(coalesce(max(ei.unlocks_at) + interval '24 hours', ev.ends_at), ev.ends_at)
      into deadline from event_images ei where ei.event_id = ev.id;
    if now() >= deadline then
      update live_events set status = 'finished' where id = ev.id;
      if not exists (select 1 from campaigns where original_event_id = ev.id) then
        insert into campaigns (world_id, title, original_event_id, is_legacy)
        values (ev.world_id, ev.title, ev.id, false);
      end if;
    end if;
  end loop;
end;
$$;
