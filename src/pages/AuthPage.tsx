import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp, resendConfirmation, requestPasswordReset } from '../stores/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { GameCard } from '../components/ui/GameCard'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Nach der Registrierung: Supabase hat noch keine Session vergeben, der Nutzer muss
  // erst den Link aus der Mail klicken. Bis dahin dieser Screen statt /worlds.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [resending, setResending] = useState(false)
  // Passwort vergessen: eigene Ansicht statt dritter Tab – der Umschalter oben bleibt
  // bei den zwei Wegen, die man normalerweise geht.
  const [showReset, setShowReset] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetting, setResetting] = useState(false)
  const navigate = useNavigate()

  function switchMode(m: 'login' | 'register') {
    setMode(m); setError(''); setPassword(''); setConfirm(''); setAccepted(false)
  }

  const canSubmit = mode === 'login'
    ? !!email.trim() && !!password
    : !!username.trim() && !!email.trim() && !!password && !!confirm && accepted

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'login') {
      if (!email.trim() || !password) { setError('Bitte fülle alle Felder aus.'); return }
      setLoading(true)
      const { error } = await signIn(email, password)
      setLoading(false)
      if (error) { setError(error); return }
      navigate('/worlds')
      return
    }

    // Registrierung
    if (password.length < 8) { setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); return }
    if (password !== confirm) { setError('Die Passwörter stimmen nicht überein.'); return }
    if (!accepted) { setError('Bitte akzeptiere die Datenschutzerklärung.'); return }

    setLoading(true)
    const { error, needsConfirmation } = await signUp(username, email, password)
    setLoading(false)
    if (error) { setError(error); return }
    if (needsConfirmation) { setAwaitingConfirm(true); return }
    navigate('/worlds')
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Bitte gib deine E-Mail-Adresse ein.'); return }
    setResetting(true); setError('')
    const { error } = await requestPasswordReset(email)
    setResetting(false)
    if (error) { setError(error); return }
    // Bewusst neutral: Supabase verrät nicht, ob die Adresse registriert ist – wir also auch nicht.
    setResetMsg('Falls ein Konto mit dieser Adresse existiert, ist der Link unterwegs. Schau notfalls im Spam-Ordner nach.')
  }

  async function handleResend() {
    setResending(true); setResendMsg('')
    const { error } = await resendConfirmation(email)
    setResending(false)
    setResendMsg(error ?? 'Bestätigungs-E-Mail wurde erneut verschickt.')
  }

  if (awaitingConfirm) {
    return (
      <div className="h-full overflow-y-auto overscroll-none bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm py-6">
          <div className="text-center mb-7">
            <div className="text-6xl mb-3">📬</div>
            <h1 className="text-3xl font-extrabold text-white drop-shadow">Fast geschafft!</h1>
          </div>
          <GameCard className="!p-5 text-center">
            <p className="text-slate-700 mb-1">
              Wir haben dir eine Bestätigungs-E-Mail an <b className="break-all">{email.trim().toLowerCase()}</b> geschickt.
            </p>
            <p className="text-slate-600 text-sm mb-4">
              Klick den Link darin, dann kannst du dich anmelden. Schau notfalls im Spam-Ordner nach.
            </p>
            {resendMsg && <p className="text-slate-600 text-sm font-medium mb-3">{resendMsg}</p>}
            <div className="flex flex-col gap-3">
              <Button variant="secondary" loading={resending} onClick={handleResend} className="w-full">
                E-Mail erneut senden
              </Button>
              <Button
                variant="success"
                className="w-full"
                onClick={() => { setAwaitingConfirm(false); switchMode('login'); setResendMsg('') }}
              >
                Zur Anmeldung
              </Button>
            </div>
          </GameCard>
        </div>
      </div>
    )
  }

  if (showReset) {
    return (
      <div className="h-full overflow-y-auto overscroll-none bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm py-6">
          <div className="text-center mb-7">
            <div className="text-6xl mb-3">🔑</div>
            <h1 className="text-3xl font-extrabold text-white drop-shadow">Passwort vergessen</h1>
          </div>
          <GameCard className="!p-5">
            {resetMsg ? (
              <div className="text-center">
                <p className="text-slate-700 text-sm mb-4">{resetMsg}</p>
                <Button variant="success" className="w-full" onClick={() => { setShowReset(false); setResetMsg(''); setError('') }}>
                  Zur Anmeldung
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <p className="text-slate-600 text-sm">
                  Gib deine E-Mail-Adresse ein – wir schicken dir einen Link, mit dem du ein neues
                  Passwort vergeben kannst.
                </p>
                <Input
                  label="E-Mail-Adresse"
                  tone="light"
                  type="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoFocus
                />
                {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}
                <Button type="submit" variant="success" size="lg" loading={resetting} className="w-full">
                  Link senden
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setError('') }}
                  className="text-sm font-semibold text-slate-500 underline"
                >
                  Zurück zur Anmeldung
                </button>
              </form>
            )}
          </GameCard>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-none bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm py-6">
        <div className="text-center mb-7">
          <div className="text-6xl mb-3">🔍</div>
          <h1 className="text-4xl font-extrabold text-white drop-shadow">Wo ist...?</h1>
          <p className="text-white/70 mt-2 font-medium">Finde die versteckte Person</p>
        </div>

        <GameCard className="!p-5">
          <div className="flex rounded-2xl bg-[#efe2c4] p-1 mb-5">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === m ? 'bg-violet-500 text-white shadow-[0_2px_0_#5b21b6]' : 'text-slate-500'}`}
              >
                {m === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <Input
                label="Benutzername"
                tone="light"
                placeholder="Dein Name"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            )}

            <Input
              label="E-Mail-Adresse"
              tone="light"
              type="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
            />

            <Input
              label="Passwort"
              tone="light"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {mode === 'register' && (
              <>
                <Input
                  label="Passwort wiederholen"
                  tone="light"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />

                <label className="flex items-start gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={e => setAccepted(e.target.checked)}
                    className="mt-0.5 w-5 h-5 accent-violet-500 flex-shrink-0"
                  />
                  <span>
                    Ich akzeptiere die{' '}
                    {/* Neuer Tab, damit das Registrierungsformular nicht ausgehängt wird
                        und die Eingaben (Name/E-Mail/Passwort/Häkchen) erhalten bleiben. */}
                    <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-violet-600 font-semibold underline">Datenschutzerklärung</a>
                  </span>
                </label>
              </>
            )}

            {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}

            <Button type="submit" variant="success" size="lg" loading={loading} disabled={!canSubmit} className="w-full mt-1">
              {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </Button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setShowReset(true); setError(''); setResetMsg('') }}
                className="text-sm font-semibold text-slate-500 underline mx-auto"
              >
                Passwort vergessen?
              </button>
            )}
          </form>
        </GameCard>
      </div>
    </div>
  )
}
