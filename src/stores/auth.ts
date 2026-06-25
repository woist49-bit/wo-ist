import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export async function signUp(username: string, password: string): Promise<{ error: string | null }> {
  const existing = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
  if (existing.data) return { error: 'Benutzername bereits vergeben.' }

  const email = `${username.toLowerCase()}@wo-ist.app`
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  if (data.user) {
    await supabase.from('profiles').insert({ id: data.user.id, username, global_xp: 0, global_level: 1, global_wins: 0 })
  }
  return { error: null }
}

export async function signIn(username: string, password: string): Promise<{ error: string | null }> {
  const email = `${username.toLowerCase()}@wo-ist.app`
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Benutzername oder Passwort falsch.' }
  return { error: null }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}
