import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../stores/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { GameCard } from '../components/ui/GameCard'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)

    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(username.trim(), password)
    setLoading(false)

    if (error) { setError(error); return }
    navigate('/worlds')
  }

  return (
    <div className="h-full overflow-y-auto overscroll-none bg-gradient-to-br from-violet-600 via-indigo-700 to-indigo-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🔍</div>
          <h1 className="text-4xl font-extrabold text-white drop-shadow">Wo ist...?</h1>
          <p className="text-white/70 mt-2 font-medium">Finde Paul im Urlaub</p>
        </div>

        <GameCard className="!p-5">
          <div className="flex rounded-2xl bg-[#efe2c4] p-1 mb-5">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === m ? 'bg-violet-500 text-white shadow-[0_2px_0_#5b21b6]' : 'text-slate-500'}`}
              >
                {m === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Benutzername"
              tone="light"
              placeholder="dein_name"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
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
            {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}
            <Button type="submit" variant="success" size="lg" loading={loading} className="w-full mt-1">
              {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </Button>
          </form>
        </GameCard>
      </div>
    </div>
  )
}
