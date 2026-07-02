import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, UserCircle, Home, MessageCircle, Trophy, Gem } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../stores/toast'
import { signOut } from '../../stores/auth'
import { IconButton } from '../ui/IconButton'

// Hauptmenü (Teal) und Welt (Slate) bewusst unterschiedlich, damit man sie nicht verwechselt.
const BG_APP = 'h-full bg-gradient-to-b from-teal-700 via-teal-800 to-slate-800 text-white flex flex-col overflow-hidden'
const BG_WORLD = 'h-full bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 text-white flex flex-col overflow-hidden'

function ProfileButton({ onClick }: { onClick: () => void }) {
  const { profile } = useAuth()
  const initial = profile?.username?.slice(0, 1).toUpperCase()
  return (
    <button
      onClick={onClick}
      className="relative w-12 h-12 rounded-full overflow-hidden bg-violet-500 text-white font-bold text-lg flex items-center justify-center shadow-[0_3px_0_#5b21b6,inset_0_2px_0_#ffffff4d] active:translate-y-[2px] active:shadow-[0_1px_0_#5b21b6,inset_0_2px_0_#ffffff4d] transition-all duration-100 touch-manipulation select-none"
      aria-label="Profil"
    >
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        : (initial || <UserCircle size={24} />)}
    </button>
  )
}

// Gem-Anzeige neben dem Profil-Button. Tippen öffnet den Shop. Zahl kommt aus dem
// zentralen Auth-Zustand -> aktualisiert sich, sobald Gems verdient/ausgegeben werden.
function GemButton() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/shop')}
      className="flex items-center gap-1.5 h-12 bg-black/20 rounded-full pl-3 pr-3.5 active:translate-y-[1px] transition-transform touch-manipulation select-none"
      aria-label="Shop"
    >
      <Gem size={19} strokeWidth={2.5} className="text-cyan-300" />
      <span className="text-white font-extrabold tabular-nums">{profile?.gems ?? 0}</span>
    </button>
  )
}

// onBack optional: ohne Back-Button (Hauptmenü) bleibt links ein Platzhalter, damit Profil rechts steht.
// bg optional: auf der Welt-Startseite die Hero-Farbe, damit oben alles ein zusammenhängender Block ist.
function HeaderBar({ onBack, onProfile, bg = '' }: { onBack?: () => void; onProfile: () => void; bg?: string }) {
  return (
    <header className={`px-3 pb-2 safe-top flex items-center justify-between flex-shrink-0 ${bg}`}>
      {onBack
        ? <IconButton variant="grey" onClick={onBack} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        : <div className="w-12" />}
      <div className="flex items-center gap-2">
        <GemButton />
        <ProfileButton onClick={onProfile} />
      </div>
    </header>
  )
}

// Layout für die globalen Screens (Welten-Liste, globale Rangliste, globales Profil)
export function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className={BG_APP}>
      <HeaderBar onProfile={() => navigate('/profile')} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0">
        <Outlet />
      </main>

      <footer className="px-12 pt-2 safe-bottom flex items-center justify-between flex-shrink-0">
        <IconButton variant="sky" onClick={() => navigate('/worlds')} aria-label="Welten"><Home size={26} strokeWidth={2.5} /></IconButton>
        <IconButton variant="amber" onClick={() => navigate('/leaderboard')} aria-label="Rangliste"><Trophy size={26} strokeWidth={2.5} /></IconButton>
      </footer>
    </div>
  )
}

// Layout innerhalb einer Spielwelt – volle Tab-Bar mit Chat
export function WorldLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!worldId || !user) return
    let active = true
    ;(async () => {
      const [worldRes, memberRes] = await Promise.all([
        supabase.from('worlds').select('whatsapp_link').eq('id', worldId).single(),
        supabase.from('world_members').select('role').eq('world_id', worldId).eq('user_id', user.id).single(),
      ])
      if (!active) return
      setWhatsappLink(worldRes.data?.whatsapp_link ?? null)
      setIsAdmin(memberRes.data?.role === 'admin')
    })()
    return () => { active = false }
  }, [worldId, user])

  const onWorldHome = location.pathname.replace(/\/$/, '') === `/world/${worldId}`

  function handleBack() {
    if (onWorldHome) navigate('/worlds')
    else navigate(-1)
  }

  function handleChat() {
    if (whatsappLink) {
      window.open(whatsappLink, '_blank', 'noopener,noreferrer')
    } else {
      addToast(
        isAdmin
          ? 'Noch kein Gruppen-Chat hinterlegt. Füge einen WhatsApp-Link in den Spielwelt-Einstellungen hinzu.'
          : 'Noch kein Gruppen-Chat verfügbar. Frag deinen Admin!',
        'info', 5000,
      )
    }
  }

  return (
    <div className={BG_WORLD}>
      <HeaderBar onBack={handleBack} onProfile={() => navigate('profile')} bg={onWorldHome ? 'bg-sky-600' : ''} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0">
        <Outlet />
      </main>

      <footer className="px-8 pt-2 safe-bottom flex items-center justify-around flex-shrink-0">
        <IconButton variant="sky" onClick={() => navigate(`/world/${worldId}`)} aria-label="Home"><Home size={26} strokeWidth={2.5} /></IconButton>
        <IconButton variant="green" onClick={handleChat} aria-label="Chat"><MessageCircle size={26} strokeWidth={2.5} /></IconButton>
        <IconButton variant="amber" onClick={() => navigate('leaderboard')} aria-label="Rangliste"><Trophy size={26} strokeWidth={2.5} /></IconButton>
      </footer>
    </div>
  )
}

export { signOut }
