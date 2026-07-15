import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updatePassword } from '../stores/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { GameCard } from '../components/ui/GameCard'

// Ziel des Links aus der „Passwort vergessen"-Mail. Der Link bringt eine Recovery-Session
// mit; supabase-js liest sie beim Start aus der URL, deshalb steht sie über useAuth bereit.
// Die Route liegt bewusst AUSSERHALB der Login-Weiche in App.tsx: mit Recovery-Session gilt
// man als eingeloggt und würde sonst sofort nach /worlds umgeleitet.
export function PasswordResetPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); return }
    if (password !== confirm) { setError('Die Passwörter stimmen nicht überein.'); return }

    setSaving(true)
    const { error: err } = await updatePassword(password)
    setSaving(false)
    if (err) { setError(err); return }
    navigate('/worlds', { replace: true })
  }

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/70 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-none bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm py-6">
        <div className="text-center mb-7">
          <div className="text-6xl mb-3">🔑</div>
          <h1 className="text-3xl font-extrabold text-white drop-shadow">Neues Passwort</h1>
        </div>

        <GameCard className="!p-5">
          {!user ? (
            // Kein Recovery-Zustand: Link abgelaufen, schon benutzt oder direkt aufgerufen.
            <div className="text-center">
              <p className="text-slate-700 font-bold mb-1">Link ungültig oder abgelaufen</p>
              <p className="text-slate-600 text-sm mb-4">
                Fordere über „Passwort vergessen?" einen neuen Link an. Jeder Link gilt nur einmal.
              </p>
              <Button variant="success" className="w-full" onClick={() => navigate('/', { replace: true })}>
                Zur Anmeldung
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-slate-600 text-sm">
                Vergib ein neues Passwort für <b className="break-all">{user.email}</b>.
              </p>
              <Input
                label="Neues Passwort"
                tone="light"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <Input
                label="Passwort wiederholen"
                tone="light"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}
              <Button type="submit" variant="success" size="lg" loading={saving} className="w-full">
                Passwort speichern
              </Button>
            </form>
          )}
        </GameCard>
      </div>
    </div>
  )
}
