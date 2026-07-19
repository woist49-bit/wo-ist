import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { signOut } from './auth'
import type { Profile } from '../types'

interface AuthValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

// Ein einziger Auth-Zustand für die ganze App: eine Session-Subscription statt einer
// pro Komponente. So propagiert refreshProfile() (z. B. nach Avatar-Upload) überall,
// inkl. Header, ohne dass Komponenten den Auth-Status doppelt abonnieren.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    // Session vorhanden, aber KEIN Profil -> der Account wurde serverseitig gelöscht.
    // Ohne das hier hinge die App im Zustand "eingeloggt ohne Profil" fest und man käme
    // weder raus noch neu rein. maybeSingle liefert bei fehlender Zeile data=null OHNE
    // Fehler; ein echter Netzfehler setzt dagegen error -> dann NICHT ausloggen (nur
    // transiente Störung), sonst würde ein Aussetzer alle rauswerfen.
    if (!error && data === null) {
      await signOut()                 // scope: 'local' -> löst SIGNED_OUT aus
      setUser(null); setProfile(null); setLoading(false)
      return
    }
    setProfile(data)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const refreshProfile = () => { if (user) loadProfile(user.id) }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
