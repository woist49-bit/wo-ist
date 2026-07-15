-- =============================================
-- profiles gegen Client-Schreibzugriffe absichern + Benutzername aendern
-- In Supabase (SQL-Editor) einmal komplett ausfuehren.
-- Laeuft in EINER Transaktion: bricht etwas ab, ist NICHTS veraendert.
-- =============================================

-- ---------------------------------------------
-- TEIL 1: Spalten-Grants (WICHTIG - schliesst ein grosses Loch)
--
-- Die Policy "Users can update own profile" (using auth.uid() = id) sagt nur, WELCHE
-- ZEILE geaendert werden darf - nicht welche SPALTEN. Und authenticated hatte von
-- Supabase aus UPDATE auf die ganze Tabelle. In profiles stehen aber gems, global_xp,
-- global_level und global_wins. Damit war das hier aus jeder Browser-Konsole moeglich:
--
--   await supabase.from('profiles').update({ gems: 999999 }).eq('id', user.id)
--
-- Das umgeht das Gem-Tages-Limit, "Gems nur aus Live-Events", die 5-Mitglieder-Regel
-- und das komplette gem_transactions-Ledger.
--
-- RLS regelt die Zeile, Grants regeln die Spalte. avatar_url ist die einzige Spalte,
-- die der Client direkt schreibt (ProfilePage). equipped_frame laeuft ueber equip_frame,
-- tutorial_completed ueber complete_tutorial, username ab jetzt ueber set_username,
-- Gems/XP ueber das Ledger. Der Entzug bricht also nichts.
-- ---------------------------------------------
revoke update on profiles from anon, authenticated;
grant update (avatar_url) on profiles to authenticated;

-- ---------------------------------------------
-- TEIL 2: Benutzername aendern
-- Als RPC statt als Spalten-Grant: so bleiben username und username_key garantiert
-- synchron (der Unique-Index haengt am key) und der Client bekommt klare Fehler
-- statt einer rohen Postgres-Meldung.
-- ---------------------------------------------
create or replace function set_username(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_display text;
  v_key text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Gleiche Normalisierung wie bei der Registrierung: trimmen, Mehrfach-Leerzeichen zu einem.
  v_display := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if v_display = '' then raise exception 'EMPTY'; end if;
  if char_length(v_display) > 20 then raise exception 'TOO_LONG'; end if;

  v_key := lower(v_display);
  -- Vorab pruefen fuer eine saubere Meldung; verbindlich ist der Unique-Index darunter.
  if exists (select 1 from profiles where username_key = v_key and id <> v_uid) then
    raise exception 'TAKEN';
  end if;

  update profiles set username = v_display, username_key = v_key where id = v_uid;
  return v_display;
end;
$$;
grant execute on function set_username(text) to authenticated;

-- =============================================
-- KONTROLLE (nach dem Lauf, aendert nichts)
-- =============================================
-- Welche Spalten darf authenticated in profiles schreiben? Erwartung: nur avatar_url.
-- select column_name, privilege_type
-- from information_schema.column_privileges
-- where table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE'
-- order by column_name;
--
-- Gegenprobe im Client (Browser-Konsole der App), MUSS ab jetzt fehlschlagen:
--   await supabase.from('profiles').update({ gems: 999999 }).eq('id', user.id)
