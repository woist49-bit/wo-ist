import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Gem, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../stores/toast'
import { SHOP_ITEMS, type ShopItem } from '../lib/shop'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'

export function ShopPage() {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState<'items' | 'cosmetics'>('items')
  const [inventory, setInventory] = useState<Map<string, number>>(new Map())
  const [buying, setBuying] = useState<string | null>(null)

  const gems = profile?.gems ?? 0

  useEffect(() => { loadInventory() }, [profile?.id])

  async function loadInventory() {
    if (!profile) return
    const { data } = await supabase.from('player_inventory').select('item_key, quantity').eq('player_id', profile.id)
    setInventory(new Map((data ?? []).map(r => [r.item_key, r.quantity])))
  }

  async function buy(item: ShopItem) {
    setBuying(item.key)
    const { error } = await supabase.rpc('buy_item', { p_item_key: item.key })
    setBuying(null)
    if (error) {
      addToast(error.message.includes('NOT_ENOUGH_GEMS') ? 'Zu wenig Gems.' : 'Kauf fehlgeschlagen.', 'error')
      return
    }
    refreshProfile()       // Gems im Header aktualisieren
    await loadInventory()  // Inventar-Anzahl aktualisieren
    addToast(`${item.name} gekauft!`, 'success')
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col animate-slide-in-up">
      <header className="px-3 pt-2 pb-2 safe-top flex items-center justify-between flex-shrink-0">
        <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        <div className="flex items-center gap-1.5 bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-full px-3.5 py-1.5 shadow-[0_3px_0_#0000001f]">
          <Gem size={19} strokeWidth={2.5} className="text-emerald-500" />
          <span className="font-extrabold text-emerald-700 tabular-nums">{gems}</span>
        </div>
      </header>

      <div className="px-4 flex-shrink-0">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-extrabold text-white mb-3">Shop</h1>
          <div className="flex rounded-2xl bg-[#efe2c4] p-1 mb-4">
            {(['items', 'cosmetics'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-violet-500 text-white shadow-[0_2px_0_#5b21b6]' : 'text-slate-500'}`}
              >
                {t === 'items' ? 'Items' : 'Cosmetics'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-none min-h-0 px-4 pb-8">
        <div className="max-w-lg mx-auto flex flex-col gap-3">
          {tab === 'items' ? (
            SHOP_ITEMS.map(item => (
              <ItemCard key={item.key} item={item} gems={gems} owned={inventory.get(item.key) ?? 0} buying={buying === item.key} onBuy={() => buy(item)} />
            ))
          ) : (
            <GameCard className="text-center py-12">
              <Sparkles size={40} strokeWidth={1.5} className="text-violet-400 mx-auto mb-3" />
              <p className="font-semibold text-slate-400">Cosmetics kommen bald.</p>
            </GameCard>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemCard({ item, gems, owned, buying, onBuy }: {
  item: ShopItem
  gems: number
  owned: number
  buying: boolean
  onBuy: () => void
}) {
  const Icon = item.icon
  const tooPoor = gems < item.price
  return (
    <GameCard>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-500 text-white flex items-center justify-center shadow-[0_2px_0_#5b21b6,inset_0_2px_0_#ffffff4d] flex-shrink-0">
          <Icon size={24} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-extrabold text-slate-800">{item.name}</p>
            {owned > 0 && <span className="text-[11px] font-extrabold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 flex-shrink-0">×{owned}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600">
              <Gem size={16} strokeWidth={2.5} /> {item.price}
            </span>
            <Button size="sm" variant="success" disabled={tooPoor || buying} loading={buying} onClick={onBuy}>
              {tooPoor ? 'Zu wenig Gems' : 'Kaufen'}
            </Button>
          </div>
        </div>
      </div>
    </GameCard>
  )
}
