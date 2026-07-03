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

// Ein Game-UI-Feld oben rechts (beige, dicker Rand) das Gem-Anzeige und Profilbild
// zusammenfasst: links die Gems in Grün (Tipp -> Shop), rechts der runde Avatar (Tipp -> Profil).
// Gem-Zahl kommt aus dem zentralen Auth-Zustand -> aktualisiert sich beim Verdienen/Ausgeben.
function HeaderWallet({ onProfile }: { onProfile: () => void }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const initial = profile?.username?.slice(0, 1).toUpperCase()
  return (
    <div className="flex items-center gap-2 bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-full py-1 pl-3.5 pr-1 shadow-[0_4px_0_#0000001f]">
      <button
        onClick={() => navigate('/shop')}
        className="flex items-center gap-1.5 active:scale-95 transition-transform touch-manipulation select-none"
        aria-label="Shop"
      >
        <Gem size={20} strokeWidth={2.5} className="text-emerald-500" />
        <span className="font-extrabold text-emerald-700 tabular-nums">{profile?.gems ?? 0}</span>
      </button>
      <button
        onClick={onProfile}
        className="relative w-10 h-10 rounded-full overflow-hidden bg-violet-500 text-white font-bold flex items-center justify-center shadow-[0_2px_0_#5b21b6,inset_0_2px_0_#ffffff4d] active:translate-y-[1px] transition-transform touch-manipulation select-none flex-shrink-0"
        aria-label="Profil"
      >
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
          : (initial || <UserCircle size={22} />)}
      </button>
    </div>
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
      <HeaderWallet onProfile={onProfile} />
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
