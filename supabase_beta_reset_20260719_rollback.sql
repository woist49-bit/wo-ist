-- =============================================================================
-- WO IST...? – ROLLBACK zum Beta-Reset vom 2026-07-19
-- Stand: 2026-07-19
--
-- Stellt den Stand VOR dem Reset aus den *_backup_20260719-Tabellen wieder her.
-- Nur ausfuehren, wenn supabase_beta_reset_20260719.sql gelaufen ist und die
-- Backup-Tabellen noch existieren.
--
-- WICHTIGE HINWEISE:
--   - Rollback = exakter Backup-Stand. Fortschritt, der NACH dem Reset neu
--     entstanden ist (z. B. jemand hat weitergespielt), wird dabei verworfen.
--   - Neue Accounts, die es zur Backup-Zeit noch nicht gab, bleiben unveraendert
--     bestehen (ihre profiles-Zeile wird vom Backup nicht angefasst).
--   - Voraussetzung fuer die Zeilen-Tabellen: die referenzierten Eltern-Zeilen
--     (event_images, campaigns, live_events, frames) existieren noch. Wurde
--     zwischenzeitlich eine Spielwelt geloescht, koennen die zugehoerigen
--     player_attempts/campaign_progress nicht zurueckgespielt werden (FK).
-- =============================================================================

begin;

-- profiles: Fortschritts-Spalten aus dem Backup zurueckspielen (Zeilen wurden
-- beim Reset nie geloescht, nur ueberschrieben).
update profiles p set
  global_xp          = b.global_xp,
  global_level       = b.global_level,
  global_wins        = b.global_wins,
  gems               = b.gems,
  legacy_points      = b.legacy_points,
  equipped_frame     = b.equipped_frame,
  tutorial_completed = b.tutorial_completed
from profiles_backup_20260719 b
where p.id = b.id;

-- Fortschritts-Tabellen: aktuellen (leeren) Stand verwerfen und exakt den
-- Backup-Stand wiederherstellen. Untereinander keine Fremdschluessel -> Reihenfolge egal.
delete from player_attempts;     insert into player_attempts     select * from player_attempts_backup_20260719;
delete from campaign_progress;   insert into campaign_progress   select * from campaign_progress_backup_20260719;
delete from player_achievements; insert into player_achievements select * from player_achievements_backup_20260719;
delete from gem_transactions;    insert into gem_transactions    select * from gem_transactions_backup_20260719;
delete from player_inventory;    insert into player_inventory    select * from player_inventory_backup_20260719;
delete from player_image_items;  insert into player_image_items  select * from player_image_items_backup_20260719;
delete from debuffs;             insert into debuffs             select * from debuffs_backup_20260719;
delete from image_item_log;      insert into image_item_log      select * from image_item_log_backup_20260719;
delete from event_result_ack;    insert into event_result_ack    select * from event_result_ack_backup_20260719;
delete from user_frames;         insert into user_frames         select * from user_frames_backup_20260719;

commit;

-- ======================= OPTIONAL: Backups aufraeumen ========================
-- Erst ausfuehren, wenn Reset bzw. Rollback endgueltig abgeschlossen sind und
-- die Snapshots nicht mehr gebraucht werden. Bewusst auskommentiert.
-- drop table if exists profiles_backup_20260719;
-- drop table if exists player_attempts_backup_20260719;
-- drop table if exists campaign_progress_backup_20260719;
-- drop table if exists player_achievements_backup_20260719;
-- drop table if exists gem_transactions_backup_20260719;
-- drop table if exists player_inventory_backup_20260719;
-- drop table if exists player_image_items_backup_20260719;
-- drop table if exists debuffs_backup_20260719;
-- drop table if exists image_item_log_backup_20260719;
-- drop table if exists event_result_ack_backup_20260719;
-- drop table if exists user_frames_backup_20260719;
