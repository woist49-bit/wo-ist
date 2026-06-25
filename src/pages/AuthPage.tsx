import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../stores/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

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
    <div className="h-full overflow-y-auto overscroll-none bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold text-white">Wo ist...?</h1>
          <p className="text-white/50 mt-2">Finde Paul im Urlaub</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'}`}
              >
                {m === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Benutzername"
              placeholder="dein_name"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
            />
            <Input
              label="Passwort"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
              {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
