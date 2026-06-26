import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

// Anzeige-Name: führende/abschließende Leerzeichen weg, Mehrfach-Leerzeichen zu einem.
function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}
// Synthetische Auth-Mail aus dem normalisierten Schlüssel (Leerzeichen -> _).
// Für alte, leerzeichenlose Namen identisch zur früheren Form -> Bestandslogins bleiben gültig.
function authEmailFor(key: string): string {
  return `${key.replace(/ /g, '_')}@wo-ist.app`
}

export async function signUp(rawUsername: string, email: string, password: string): Promise<{ error: string | null }> {
  const display = normalizeUsername(rawUsername)
  if (!display) return { error: 'Bitte gib einen Benutzernamen ein.' }
  if (password.length < 8) return { error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }

  const key = display.toLowerCase()
  const cleanEmail = email.trim()

  // Benutzername-Eindeutigkeit (normalisiert)
  const { data: nameUsed } = await supabase.from('profiles').select('id').eq('username_key', key).maybeSingle()
  if (nameUsed) return { error: 'Dieser Benutzername ist bereits vergeben.' }

  // E-Mail-Eindeutigkeit (über RPC, ohne fremde E-Mails offenzulegen)
  const { data: emailUsed } = await supabase.rpc('email_taken', { p_email: cleanEmail })
  if (emailUsed) return { error: 'Diese E-Mail-Adresse ist bereits registriert.' }

  const { data, error } = await supabase.auth.signUp({ email: authEmailFor(key), password })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { error: 'Dieser Benutzername ist bereits vergeben.' }
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.' }
  }

  if (data.user) {
    await supabase.from('profiles').insert({ id: data.user.id, username: display, username_key: key, global_xp: 0, global_level: 1, global_wins: 0 })
    await supabase.from('account_recovery').insert({ user_id: data.user.id, email: cleanEmail })
  }
  return { error: null }
}

export async function signIn(rawUsername: string, password: string): Promise<{ error: string | null }> {
  const key = normalizeUsername(rawUsername).toLowerCase()
  if (!key || !password) return { error: 'Bitte fülle alle Felder aus.' }

  const { error } = await supabase.auth.signInWithPassword({ email: authEmailFor(key), password })
  if (error) {
    if (/invalid|credential|not.*confirm/i.test(error.message)) return { error: 'Benutzername oder Passwort ist falsch.' }
    return { error: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.' }
  }
  return { error: null }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}
