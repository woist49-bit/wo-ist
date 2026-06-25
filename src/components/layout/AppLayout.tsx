import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, UserCircle, Home, MessageCircle, Trophy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../stores/toast'
import { signOut } from '../../stores/auth'
import { IconButton } from '../ui/IconButton'

function ProfileButton({ onClick }: { onClick: () => void }) {
  const { profile } = useAuth()
  const initial = profile?.username?.slice(0, 1).toUpperCase()
  return (
    <button
      onClick={onClick}
      className="w-11 h-11 rounded-2xl bg-indigo-500 text-white font-bold text-lg flex items-center justify-center shadow-[0_3px_0_#3730a3] active:translate-y-[2px] active:shadow-[0_1px_0_#3730a3] transition-all duration-100 touch-manipulation select-none"
      aria-label="Profil"
    >
      {initial || <UserCircle size={24} />}
    </button>
  )
}

function HeaderBar({ onBack, onProfile }: { onBack: () => void; onProfile: () => void }) {
  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-white/10 px-3 pb-2 safe-top flex items-center justify-between">
      <IconButton onClick={onBack} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
      <ProfileButton onClick={onProfile} />
    </header>
  )
}

// Layout für die globalen Screens (Welten-Liste, globale Rangliste, globales Profil)
export function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      <HeaderBar onBack={() => navigate(-1)} onProfile={() => navigate('/profile')} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0">
        <Outlet />
      </main>

      <footer className="bg-slate-900/95 backdrop-blur border-t border-white/10 px-10 pt-2 safe-bottom flex items-center justify-between">
        <IconButton onClick={() => navigate('/worlds')} aria-label="Welten"><Home size={26} strokeWidth={2.5} /></IconButton>
        <IconButton onClick={() => navigate('/leaderboard')} aria-label="Rangliste"><Trophy size={26} strokeWidth={2.5} /></IconButton>
      </footer>
    </div>
  )
}

// Layout innerhalb einer Spielwelt – volle Tab-Bar mit Chat
export function WorldLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { worldId } = useParams<{ worldId: string }>()
  const { addToast } = useToast()

  const onWorldHome = location.pathname.replace(/\/$/, '') === `/world/${worldId}`

  function handleBack() {
    if (onWorldHome) navigate('/worlds')
    else navigate(-1)
  }

  function handleChat() {
    // TODO (Etappe Chat): echten WhatsApp-Link aus den Spielwelt-Einstellungen lesen + Admin-Variante.
    addToast('Noch kein Gruppen-Chat verfügbar. Frag deinen Admin!', 'info', 4000)
  }

  return (
    <div className="h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      <HeaderBar onBack={handleBack} onProfile={() => navigate('profile')} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0">
        <Outlet />
      </main>

      <footer className="bg-slate-900/95 backdrop-blur border-t border-white/10 px-8 pt-2 safe-bottom flex items-center justify-around">
        <IconButton onClick={() => navigate(`/world/${worldId}`)} aria-label="Home"><Home size={26} strokeWidth={2.5} /></IconButton>
        <IconButton onClick={handleChat} aria-label="Chat"><MessageCircle size={26} strokeWidth={2.5} /></IconButton>
        <IconButton onClick={() => navigate('leaderboard')} aria-label="Rangliste"><Trophy size={26} strokeWidth={2.5} /></IconButton>
      </footer>
    </div>
  )
}

export { signOut }
