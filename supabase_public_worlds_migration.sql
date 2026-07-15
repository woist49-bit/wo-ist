-- =============================================
-- Oeffentliche Spielwelten + Daumen-hoch
-- In Supabase (SQL-Editor) einmal komplett ausfuehren.
-- Laeuft in EINER Transaktion: bricht etwas ab, ist NICHTS veraendert.
-- Idempotent: kann gefahrlos mehrfach laufen.
-- =============================================

-- ---------------------------------------------
-- TEIL 1: Sichtbarkeit der Spielwelt
-- ---------------------------------------------
alter table worlds add column if not exists is_public boolean not null default false;

-- ---------------------------------------------
-- TEIL 2: Daumen-hoch
-- Der Primaerschluessel (world_id, user_id) IST der Unique-Constraint: ein Nutzer
-- kann eine Spielwelt nur einmal bewerten. Keine Verbindung zu Punkten/Gems/XP.
-- ---------------------------------------------
create table if not exists world_likes (
  world_id uuid not null references worlds(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
alter table world_likes enable row level security;

-- Bewertungen sieht man nur fuer Welten, in denen man Mitglied ist. Die Zahlen fuer
-- die oeffentliche Liste liefert public_worlds() (security definer) - dort darf man
-- die Welt ja noch nicht sehen.
drop policy if exists "Members can view likes" on world_likes;
create policy "Members can view likes" on world_likes for select
  using (exists (select 1 from world_members wm where wm.world_id = world_likes.world_id and wm.user_id = auth.uid()));

-- Bewerten erst NACH dem Beitritt - serverseitig, nicht nur im UI ausgeblendet.
drop policy if exists "Members can like" on world_likes;
create policy "Members can like" on world_likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from world_members wm where wm.world_id = world_likes.world_id and wm.user_id = auth.uid())
  );

drop policy if exists "Own like can be removed" on world_likes;
create policy "Own like can be removed" on world_likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------
-- TEIL 3: Liste der oeffentlichen Spielwelten
-- security definer, weil der Aufrufer noch KEIN Mitglied ist: world_members,
-- campaigns und live_events sind fuer ihn per RLS unsichtbar. Gibt bewusst NICHT
-- join_code zurueck - sonst waere der Einladungscode jeder oeffentlichen Welt
-- fuer jeden abgreifbar.
-- Sortierung: beliebteste zuerst, bei Gleichstand die neuere Welt.
-- ---------------------------------------------
create or replace function public_worlds()
returns table (
  id uuid,
  name text,
  description text,
  members bigint,
  campaigns bigint,
  active_event text,
  likes bigint
)
language sql security definer set search_path = public stable as $$
  select
    w.id,
    w.name,
    w.description,
    (select count(*) from world_members wm where wm.world_id = w.id),
    (select count(*) from campaigns c where c.world_id = w.id),
    (select le.title from live_events le
      where le.world_id = w.id and le.status = 'active'
      order by le.starts_at desc limit 1),
    (select count(*) from world_likes wl where wl.world_id = w.id)
  from worlds w
  where w.is_public
    and auth.uid() is not null
    and not exists (
      select 1 from world_members wm where wm.world_id = w.id and wm.user_id = auth.uid()
    )
  order by 7 desc, w.created_at desc
$$;
grant execute on function public_worlds() to authenticated;

-- ---------------------------------------------
-- TEIL 4: Beitritt ohne Code (nur oeffentliche Welten)
-- Nutzt auth.uid() statt eines Parameters -> niemand kann Fremde eintragen.
-- ---------------------------------------------
create or replace function join_public_world(p_world_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from worlds where id = p_world_id and is_public) then
    raise exception 'NOT_PUBLIC';
  end if;
  if exists (select 1 from world_members where world_id = p_world_id and user_id = v_uid) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into world_members (world_id, user_id, role) values (p_world_id, v_uid, 'user');
  return p_world_id;
end;
$$;
grant execute on function join_public_world(uuid) to authenticated;

-- ---------------------------------------------
-- TEIL 5: Luecke in join_world schliessen (Anti-Exploit)
-- join_world vertraute dem uebergebenen p_user_id. profiles ist fuer alle lesbar
-- (noetig fuer die Ranglisten) -> jeder konnte sich fremde User-IDs holen und sie
-- mit dem eigenen Code in die eigene Welt zwingen. Damit waren die "5 Mitglieder
-- fuer Live-Events" trivial zu faelschen und die Gem-Quelle wieder offen.
-- Signatur bleibt, damit der Client unveraendert bleibt.
-- ---------------------------------------------
create or replace function join_world(p_user_id uuid, p_join_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_world_id uuid;
begin
  -- Eingeloggte Clients duerfen nur sich selbst beitreten lassen.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

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
-- KONTROLLE (nach dem Lauf, aendert nichts)
-- =============================================
-- Oeffentliche Welten mit ihren Bewertungen:
-- select w.name, w.is_public, (select count(*) from world_likes wl where wl.world_id = w.id) as likes
-- from worlds w where w.is_public order by likes desc;
--
-- Als eingeloggter Client (nicht im SQL-Editor - dort ist auth.uid() null):
-- select * from public_worlds();
