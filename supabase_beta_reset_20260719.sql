-- =============================================================================
-- WO IST...? – Beta-Reset: Spieler-Fortschritt auf Ausgangszustand
-- Stand: 2026-07-19
--
-- Setzt bei ALLEN Spielern Punkte, XP, Level, Gems, legacy_points, Inventar,
-- Items, Debuffs, Erfolge, Cosmetics (Rahmen) und den Tutorial-Status zurueck.
-- Die Accounts selbst (auth.users, Benutzername, E-Mail, avatar_url) sowie alle
-- Welt-/Content-Tabellen (worlds, world_members, live_events, event_images,
-- campaigns, frames-Katalog, world_likes) bleiben UNANGETASTET.
--
-- ANWENDUNG:
--   1. Inhalt komplett in den Supabase SQL-Editor kopieren und ausfuehren.
--   2. Laeuft komplett in EINER Transaktion (BEGIN/COMMIT) -> alles oder nichts.
--   3. Der Backup-Block legt Snapshot-Tabellen *_backup_20260719 an.
--      Bewusst OHNE "if not exists": existiert ein Backup bereits (Skript schon
--      gelaufen), bricht die Transaktion mit Fehler ab und der Reset laeuft NICHT
--      erneut -> das vorhandene Backup wird geschuetzt. Zum absichtlichen
--      Neu-Ausfuehren zuerst die alten *_backup_20260719-Tabellen droppen.
--   4. Rollback bei Bedarf: supabase_beta_reset_20260719_rollback.sql
-- =============================================================================

begin;

-- ============================ BACKUP =========================================
-- Voller Zeilen-Snapshot je Tabelle (CREATE TABLE AS kopiert nur Daten, keine
-- Constraints/Indizes – fuer Backup/Rollback der Daten ausreichend).
create table profiles_backup_20260719           as select * from profiles;
create table player_attempts_backup_20260719    as select * from player_attempts;
create table campaign_progress_backup_20260719   as select * from campaign_progress;
create table player_achievements_backup_20260719 as select * from player_achievements;
create table gem_transactions_backup_20260719    as select * from gem_transactions;
create table player_inventory_backup_20260719    as select * from player_inventory;
create table player_image_items_backup_20260719  as select * from player_image_items;
create table debuffs_backup_20260719             as select * from debuffs;
create table image_item_log_backup_20260719      as select * from image_item_log;
create table event_result_ack_backup_20260719    as select * from event_result_ack;
create table user_frames_backup_20260719         as select * from user_frames;

-- ============================ RESET ==========================================
-- profiles: nur Fortschritts-Spalten zuruecksetzen, Zeile + Identitaet bleiben.
--   equipped_frame -> null gehoert zum Loeschen der user_frames (unten).
--   tutorial_completed -> false, damit die Erfolge wirklich leer bleiben (sonst
--   vergibt recheck_achievements 'tutorial_master' beim naechsten Spielzug neu).
update profiles set
  global_xp          = 0,
  global_level       = 1,
  global_wins        = 0,
  gems               = 0,
  legacy_points      = 0,
  equipped_frame     = null,
  tutorial_completed = false;

-- Fortschritts-Tabellen komplett leeren. Untereinander bestehen keine
-- Fremdschluessel -> Reihenfolge ist egal.
delete from player_attempts;
delete from campaign_progress;
delete from player_achievements;
delete from gem_transactions;      -- Gem-Ledger, damit es zu gems = 0 passt
delete from player_inventory;
delete from player_image_items;
delete from debuffs;
delete from image_item_log;
delete from event_result_ack;
delete from user_frames;           -- gekaufte Rahmen (Cosmetics)

commit;

-- ======================= VERIFIKATION (read-only) ============================
-- Nach COMMIT ausfuehrbar. Alle Werte muessen 0 sein.
select
  (select count(*) from profiles
     where global_xp <> 0 or global_level <> 1 or global_wins <> 0
        or gems <> 0 or legacy_points <> 0
        or equipped_frame is not null or tutorial_completed) as profiles_nicht_zurueckgesetzt,
  (select count(*) from player_attempts)    as player_attempts,
  (select count(*) from campaign_progress)   as campaign_progress,
  (select count(*) from player_achievements) as player_achievements,
  (select count(*) from gem_transactions)    as gem_transactions,
  (select count(*) from player_inventory)    as player_inventory,
  (select count(*) from player_image_items)  as player_image_items,
  (select count(*) from debuffs)             as debuffs,
  (select count(*) from image_item_log)      as image_item_log,
  (select count(*) from event_result_ack)    as event_result_ack,
  (select count(*) from user_frames)         as user_frames;
