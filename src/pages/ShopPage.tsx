import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Gem } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { IconButton } from '../components/ui/IconButton'

// Phase-1-Platzhalter. Der eigentliche Shop (Items/Cosmetics) kommt in Phase 2.
export function ShopPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col animate-slide-in-up">
      <header className="px-3 pt-2 pb-2 safe-top flex items-center justify-between flex-shrink-0">
        <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        <div className="flex items-center gap-1.5 h-12 bg-black/20 rounded-full pl-3 pr-3.5">
          <Gem size={19} strokeWidth={2.5} className="text-cyan-300" />
          <span className="text-white font-extrabold tabular-nums">{profile?.gems ?? 0}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <Gem size={56} strokeWidth={1.5} className="text-cyan-300 mb-4" />
        <h1 className="text-2xl font-extrabold text-white mb-2">Shop</h1>
        <p className="text-white/70 max-w-xs">Hier kannst du bald Items und Cosmetics gegen Gems kaufen. Kommt in Kürze!</p>
      </div>
    </div>
  )
}
