-- =============================================
-- E-Mail wird Auth-Identitaet (statt synthetischer benutzer@wo-ist.app-Adresse)
-- In Supabase (SQL-Editor) einmal komplett ausfuehren.
-- Laeuft in EINER Transaktion: bricht etwas ab, ist NICHTS veraendert.
--
-- WICHTIG - Reihenfolge:
--   1. Supabase: Custom SMTP einrichten (sonst 2 Mails/Stunde -> unbrauchbar)
--   2. Supabase: Authentication -> URL Configuration -> Site-URL + Redirect-URLs setzen
--   3. Dieses SQL ausfuehren
--   4. Neue App-Version deployen   <- moeglichst direkt nach 3
--   5. Supabase: Authentication -> Providers -> Email -> "Confirm email" AN
--
-- ACHTUNG, Zeitfenster zwischen 3 und 4: Der alte Client meldet sich mit der
-- synthetischen Adresse an, die es dann nicht mehr gibt -> NEUE Anmeldungen und
-- Registrierungen schlagen in dieser Zeit fehl. Bereits eingeloggte Sessions laufen
-- unveraendert weiter (das JWT bleibt gueltig). Also in einem ruhigen Moment machen
-- und 3+4 direkt hintereinander. Ein Fenster ist unvermeidbar: auth.users kennt pro
-- Konto genau eine Adresse, alte und neue Anmeldeform koennen nicht gleichzeitig gelten.
--
-- Schritt 5 zuletzt: Waere "Confirm email" schon vor dem Deploy an, bekaeme der alte
-- Client beim Signup keine Session mehr und wuerde Auth-User ohne Profil hinterlassen.
-- =============================================

-- ---------------------------------------------
-- TEIL 0: Vorab-Pruefungen. Schlaegt eine an, bricht alles ab und nichts ist passiert.
-- ---------------------------------------------
do $$
declare v_n integer;
begin
  -- a) auth.users.email ist UNIQUE -> doppelte echte Adressen wuerden die Migration sprengen
  select count(*) into v_n from (
    select lower(trim(email)) from account_recovery group by 1 having count(*) > 1
  ) t;
  if v_n > 0 then
    raise exception 'ABBRUCH: % E-Mail-Adresse(n) sind mehrfach vergeben. Pruefe mit: select lower(trim(email)), count(*) from account_recovery group by 1 having count(*) > 1;', v_n;
  end if;

  -- b) Profile ohne hinterlegte Mail koennten sich nach der Umstellung nicht mehr anmelden
  select count(*) into v_n from profiles p
  where not exists (select 1 from account_recovery ar where ar.user_id = p.id);
  if v_n > 0 then
    raise exception 'ABBRUCH: % Profil(e) haben keine E-Mail in account_recovery und koennten sich nicht mehr anmelden. Pruefe mit: select p.id, p.username from profiles p where not exists (select 1 from account_recovery ar where ar.user_id = p.id);', v_n;
  end if;

  -- c) Normalisiert kollidierende Benutzernamen verhindern den Unique-Index unten
  select count(*) into v_n from (
    select username_key from profiles group by 1 having count(*) > 1
  ) t;
  if v_n > 0 then
    raise exception 'ABBRUCH: % Benutzername(n) kollidieren normalisiert. Pruefe mit: select username_key, count(*) from profiles group by 1 having count(*) > 1;', v_n;
  end if;
end;
$$;

-- ---------------------------------------------
-- TEIL 1: Bestand auf die echte Adresse umstellen
-- email_confirmed_at bleibt unangetastet -> niemand wird ausgesperrt, Passwoerter bleiben.
-- Einzige Aenderung fuer Bestandsnutzer: Anmeldung ab jetzt mit der E-Mail statt dem
-- Benutzernamen.
-- ---------------------------------------------
update auth.users u
set email = lower(trim(ar.email)),
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('username', p.username, 'username_key', p.username_key)
from account_recovery ar
join profiles p on p.id = ar.user_id
where u.id = ar.user_id;

-- GoTrue haelt die Adresse zusaetzlich in der Identity. Der Passwort-Login schlaegt zwar
-- ueber auth.users nach, aber eine stehengebliebene Alt-Adresse hier faellt einem spaeter
-- bei Mail-Wechsel/Recovery auf die Fuesse.
update auth.identities i
set identity_data = coalesce(i.identity_data, '{}'::jsonb)
      || jsonb_build_object('email', lower(trim(ar.email)))
from account_recovery ar
where i.user_id = ar.user_id and i.provider = 'email';

-- ---------------------------------------------
-- TEIL 2: Benutzername-Eindeutigkeit verbindlich machen
-- Bisher gab es nur einen Index + eine Client-Pruefung -> zwei gleichzeitige Signups
-- konnten denselben Namen belegen. Der Unique-Index ist zugleich die Absicherung des
-- Triggers unten.
-- ---------------------------------------------
create unique index if not exists profiles_username_key_uniq on profiles (username_key);

-- ---------------------------------------------
-- TEIL 3: Profil per Trigger anlegen statt per Client-Insert
-- Bei aktiver E-Mail-Bestaetigung hat der Client beim Signup noch KEINE Session -> ein
-- Insert wuerde an RLS scheitern. Nebenbei behoben: bisher konnte ein Signup einen
-- Auth-User OHNE Profil hinterlassen, wenn der Insert danach fehlschlug. Jetzt haengen
-- beide in einer Transaktion - scheitert das Profil, entsteht auch kein Auth-User.
-- Hinweis: Nutzer, die im Supabase-Dashboard von Hand angelegt werden, brauchen
-- raw_user_meta_data.username, sonst schlaegt die Anlage bewusst fehl.
-- ---------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_display text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  v_key text;
begin
  if v_display is null then
    raise exception 'USERNAME_MISSING: signUp muss options.data.username mitgeben';
  end if;
  v_display := regexp_replace(v_display, '\s+', ' ', 'g');
  v_key := lower(v_display);
  insert into profiles (id, username, username_key, global_xp, global_level, global_wins)
  values (new.id, v_display, v_key, 0, 1, 0);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------
-- TEIL 4: Aufraeumen
-- email_taken las account_recovery und wird vom Client nicht mehr gerufen - die
-- Eindeutigkeit der Adresse erzwingt jetzt Supabase selbst ueber auth.users.email.
-- ---------------------------------------------
drop function if exists email_taken(text);

-- account_recovery bleibt vorerst ABSICHTLICH stehen: es ist die einzige Sicherungskopie
-- der Zuordnung Nutzer -> echte Adresse, falls an der Umstellung etwas schieflaeuft.
-- Die Daten stehen ab jetzt in auth.users.email. Erst loeschen, wenn sich alle einmal
-- erfolgreich per E-Mail angemeldet haben:
--
--   drop table account_recovery;

-- =============================================
-- KONTROLLE (nach dem Lauf ausfuehren, aendert nichts)
-- =============================================
-- Erwartung: jede Zeile zeigt die echte Adresse, keine endet auf @wo-ist.app
-- select p.username, u.email, (u.email_confirmed_at is not null) as bestaetigt
-- from profiles p join auth.users u on u.id = p.id
-- order by p.username;
