import { useNavigate } from 'react-router-dom'
import { Gem, UserCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

// Ein Game-UI-Feld oben rechts (beige, dicker Rand) das Gem-Anzeige und Profilbild
// zusammenfasst: links die Gems in Grün (Tipp -> Shop), rechts der runde Avatar (Tipp -> Profil).
// Gem-Zahl kommt aus dem zentralen Auth-Zustand -> aktualisiert sich beim Verdienen/Ausgeben.
export function HeaderWallet({ onProfile }: { onProfile: () => void }) {
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
