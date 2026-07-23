-- =============================================================================
-- WO IST...? – Fix: Tutorial-Erfolg (tutorial_master) wurde nicht vergeben
-- Ursache: complete_tutorial() schrieb noch in player_achievements.world_id, die
-- Spalte wurde aber entfernt (supabase_antiexploit_migration.sql). Der Insert warf
-- einen Fehler -> die ganze Transaktion (inkl. tutorial_completed) rollte zurück.
-- Fix: Insert ohne world_id + idempotent.
-- =============================================================================

create or replace function complete_tutorial(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_first boolean;
begin
  select not coalesce(tutorial_completed, false) into v_first from profiles where id = p_user_id;
  update profiles set tutorial_completed = true where id = p_user_id;
  if v_first and not exists (
    select 1 from player_achievements where user_id = p_user_id and achievement_key = 'tutorial_master'
  ) then
    insert into player_achievements (user_id, achievement_key)
    values (p_user_id, 'tutorial_master')
    on conflict (user_id, achievement_key) do nothing;
    perform add_xp(p_user_id, 150, null);
    perform award_gems(p_user_id, 10, 'achievement', 'tutorial_master'); -- Bronze
    return true;
  end if;
  return false;
end;
$$;
