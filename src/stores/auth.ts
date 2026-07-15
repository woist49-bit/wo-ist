import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

// Anzeige-Name: führende/abschließende Leerzeichen weg, Mehrfach-Leerzeichen zu einem.
function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

// Ziel des Bestätigungslinks aus der E-Mail. Muss in Supabase unter
// Authentication -> URL Configuration als Redirect-URL erlaubt sein.
function confirmRedirectTo(): string {
  return `${window.location.origin}/`
}

export type SignUpResult = { error: string | null; needsConfirmation: boolean }

// Registriert mit der ECHTEN E-Mail als Auth-Identität. Das Profil legt der
// DB-Trigger handle_new_user aus den Metadaten an – nicht der Client: bei aktiver
// E-Mail-Bestätigung gibt es hier noch keine Session, ein Insert würde an RLS scheitern.
export async function signUp(rawUsername: string, email: string, password: string): Promise<SignUpResult> {
  const display = normalizeUsername(rawUsername)
  if (!display) return { error: 'Bitte gib einen Benutzernamen ein.', needsConfirmation: false }
  if (password.length < 8) return { error: 'Das Passwort muss mindestens 8 Zeichen lang sein.', needsConfirmation: false }

  const key = display.toLowerCase()
  const cleanEmail = normalizeEmail(email)

  // Vorab-Prüfung nur für eine freundliche Meldung. Verbindlich ist der Unique-Index
  // auf username_key: kollidiert er, scheitert der Trigger und damit der ganze Signup.
  const { data: nameUsed } = await supabase.from('profiles').select('id').eq('username_key', key).maybeSingle()
  if (nameUsed) return { error: 'Dieser Benutzername ist bereits vergeben.', needsConfirmation: false }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { username: display, username_key: key },
      emailRedirectTo: confirmRedirectTo(),
    },
  })

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: 'Diese E-Mail-Adresse ist bereits registriert.', needsConfirmation: false }
    }
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.', needsConfirmation: false }
  }

  // Supabase meldet eine bereits registrierte Adresse aus Datenschutzgründen NICHT als
  // Fehler, sondern liefert einen Nutzer ohne Identities zurück. Ohne diese Prüfung
  // landet der Nutzer auf dem "Postfach prüfen"-Screen und wartet ewig auf eine Mail.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: 'Diese E-Mail-Adresse ist bereits registriert.', needsConfirmation: false }
  }

  // Bei aktivierter Bestätigung gibt Supabase keine Session zurück -> Postfach-Screen.
  return { error: null, needsConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const cleanEmail = normalizeEmail(email)
  if (!cleanEmail || !password) return { error: 'Bitte fülle alle Felder aus.' }

  const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
  if (error) {
    if (/not.*confirm/i.test(error.message)) {
      return { error: 'Bitte bestätige zuerst deine E-Mail-Adresse. Den Link findest du in deinem Postfach.' }
    }
    if (/invalid|credential/i.test(error.message)) return { error: 'E-Mail-Adresse oder Passwort ist falsch.' }
    return { error: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.' }
  }
  return { error: null }
}

export async function resendConfirmation(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
    options: { emailRedirectTo: confirmRedirectTo() },
  })
  if (error) {
    if (/rate|limit|seconds|too many/i.test(error.message)) {
      return { error: 'Bitte warte einen Moment, bevor du es erneut versuchst.' }
    }
    return { error: 'Senden fehlgeschlagen. Bitte versuche es später erneut.' }
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
