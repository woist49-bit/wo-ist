-- =============================================================================
-- WO IST...? – Push-Benachrichtigungen, Teil 1: Abo-Tabelle
-- Speichert die Web-Push-Abos der Geräte. Ein Nutzer kann mehrere Geräte haben
-- (je Gerät ein Abo = ein endpoint). Der Versand (Edge Function, Teil 2) liest hier.
-- =============================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,          -- eindeutige Push-URL des Geräts (vom Browser vergeben)
  p256dh text not null,            -- öffentlicher Schlüssel des Abos (Verschlüsselung)
  auth text not null,              -- Auth-Secret des Abos (Verschlüsselung)
  user_agent text,                 -- nur zur Übersicht, welches Gerät
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- Jeder verwaltet ausschließlich seine eigenen Abos. Der Versand läuft über die
-- Edge Function mit der Service-Role (umgeht RLS) und darf alle lesen.
drop policy if exists "own push subs select" on push_subscriptions;
drop policy if exists "own push subs insert" on push_subscriptions;
drop policy if exists "own push subs update" on push_subscriptions;
drop policy if exists "own push subs delete" on push_subscriptions;
create policy "own push subs select" on push_subscriptions for select using (auth.uid() = user_id);
create policy "own push subs insert" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "own push subs update" on push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own push subs delete" on push_subscriptions for delete using (auth.uid() = user_id);
