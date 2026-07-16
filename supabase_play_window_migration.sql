-- =============================================
-- Live-Event-Bilder nach Ablauf des 24h-Fensters nicht mehr spielbar
-- In Supabase (SQL-Editor) einmal ausfuehren. Idempotent.
--
-- Bisher prueft die Insert-Policy nur die Untergrenze (unlocks_at <= now()) – ein
-- Bild blieb also nach den 24h weiter spielbar UND gab weiter Punkte. Jetzt zusaetzlich
-- die Obergrenze: nur innerhalb von [unlocks_at, unlocks_at + 24h) darf ein Versuch rein.
-- Das ist der autoritative Riegel; Client-Checks sind nur Komfort.
--
-- Die 24h sind konsistent mit IMAGE_PLAY_WINDOW_MS (Frontend) und dem last_minute-
-- Achievement-Fenster (unlocks_at + 23h..24h) – ein Fund bei 23:59 zaehlt noch, bei
-- exakt 24:00 nicht mehr.
-- =============================================

drop policy if exists "Users can insert own attempt" on player_attempts;
create policy "Users can insert own attempt" on player_attempts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from event_images ei
      where ei.id = player_attempts.image_id
        and ei.unlocks_at <= now()
        and ei.unlocks_at > now() - interval '24 hours'
    )
  );

-- =============================================
-- KONTROLLE (nach dem Lauf, aendert nichts)
-- =============================================
-- Abgelaufene Bilder, in denen NACH Ablauf noch Versuche gelandet sind (Altdaten aus
-- der Zeit vor dem Fix; werden nicht rueckwirkend entfernt):
-- select ei.id, count(*) as verspaetete_versuche
-- from player_attempts pa
-- join event_images ei on ei.id = pa.image_id
-- where ei.event_id is not null
--   and pa.attempted_at >= ei.unlocks_at + interval '24 hours'
-- group by ei.id order by verspaetete_versuche desc;
