import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Gem } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../stores/toast'
import { SHOP_ITEMS, type ShopItem } from '../lib/shop'
import { FRAMES, RARITY_STYLE, type FrameDef } from '../lib/frames'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'
import { IconButton } from '../components/ui/IconButton'
import { HeaderWallet } from '../components/layout/HeaderWallet'
import { AvatarFrame } from '../components/ui/AvatarFrame'

export function ShopPage() {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState<'items' | 'cosmetics'>('items')
  const [inventory, setInventory] = useState<Map<string, number>>(new Map())
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [buying, setBuying] = useState<string | null>(null)

  const gems = profile?.gems ?? 0
  const equipped = profile?.equipped_frame ?? null

  useEffect(() => { loadInventory(); loadCosmetics() }, [profile?.id])

  async function loadInventory() {
    if (!profile) return
    const { data } = await supabase.from('player_inventory').select('item_key, quantity').eq('player_id', profile.id)
    setInventory(new Map((data ?? []).map(r => [r.item_key, r.quantity])))
  }

  async function loadCosmetics() {
    if (!profile) return
    const { data } = await supabase.from('user_frames').select('frame_id').eq('user_id', profile.id)
    setOwned(new Set((data ?? []).map(r => r.frame_id)))
  }

  async function buy(item: ShopItem) {
    setBuying(item.key)
    const { error } = await supabase.rpc('buy_item', { p_item_key: item.key })
    setBuying(null)
    if (error) {
      const m = error.message || ''
      const text = m.includes('NOT_ENOUGH_GEMS') ? 'Zu wenig Gems.'
        : m.includes('UNKNOWN_ITEM') ? 'Item noch nicht verfügbar – ist die buy_item-RPC aktuell?'
        : `Kauf fehlgeschlagen: ${m}`
      addToast(text, 'error', 6000)
      return
    }
    refreshProfile()       // Gems im Header aktualisieren
    await loadInventory()  // Inventar-Anzahl aktualisieren
    addToast(`${item.name} gekauft!`, 'success')
  }

  async function buyFrame(f: FrameDef) {
    setBuying(f.id)
    const { error } = await supabase.rpc('buy_frame', { p_frame_id: f.id })
    setBuying(null)
    if (error) {
      const m = error.message || ''
      const text = m.includes('NOT_ENOUGH_GEMS') ? 'Zu wenig Gems.'
        : m.includes('UNKNOWN_FRAME') ? 'Rahmen nicht verfügbar – ist das Phase-8-SQL ausgeführt?'
        : `Kauf fehlgeschlagen: ${m}`
      addToast(text, 'error', 6000)
      return
    }
    refreshProfile()
    await loadCosmetics()
    addToast(`${f.name} gekauft!`, 'success')
  }

  async function equipFrame(id: string | null) {
    setBuying(id ?? '__none')
    const { error } = await supabase.rpc('equip_frame', { p_frame_id: id })
    setBuying(null)
    if (error) { addToast('Ausrüsten fehlgeschlagen: ' + (error.message || ''), 'error', 6000); return }
    refreshProfile() // profile.equipped_frame -> Header & Vorschau aktualisieren
    addToast(id ? 'Rahmen ausgerüstet!' : 'Rahmen abgelegt.', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col animate-slide-in-up">
      <header className="px-3 pt-2 pb-2 safe-top flex items-center justify-between flex-shrink-0">
        <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        <HeaderWallet onProfile={() => navigate('/profile')} />
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
        {tab === 'items' ? (
          <div className="max-w-lg mx-auto flex flex-col gap-3">
            {SHOP_ITEMS.map(item => (
              <ItemCard key={item.key} item={item} gems={gems} owned={inventory.get(item.key) ?? 0} buying={buying === item.key} onBuy={() => buy(item)} />
            ))}
          </div>
        ) : (
          <div className="max-w-lg mx-auto">
            <p className="text-white/50 text-sm mb-3">Profilbild-Rahmen – überall sichtbar, wo dein Avatar erscheint.</p>
            <div className="grid grid-cols-2 gap-3">
              {FRAMES.map(f => (
                <FrameCard
                  key={f.id}
                  frame={f}
                  gems={gems}
                  owned={owned.has(f.id)}
                  equipped={equipped === f.id}
                  busy={buying === f.id}
                  avatarUrl={profile?.avatar_url ?? null}
                  username={profile?.username ?? null}
                  onBuy={() => buyFrame(f)}
                  onEquip={equipFrame}
                />
              ))}
            </div>
          </div>
        )}
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
          <div className="mt-3">
            {/* Kaufen = blau mit Preis (einheitlich mit Cosmetics) */}
            <Button size="sm" variant="info" className="w-full" disabled={tooPoor || buying} loading={buying} onClick={onBuy}>
              <span className="inline-flex items-center gap-1.5">{tooPoor ? 'Zu wenig' : 'Kaufen'} · <Gem size={14} strokeWidth={2.5} /> {item.price}</span>
            </Button>
          </div>
        </div>
      </div>
    </GameCard>
  )
}

function FrameCard({ frame, gems, owned, equipped, busy, avatarUrl, username, onBuy, onEquip }: {
  frame: FrameDef
  gems: number
  owned: boolean
  equipped: boolean
  busy: boolean
  avatarUrl: string | null
  username: string | null
  onBuy: () => void
  onEquip: (id: string | null) => void
}) {
  const tooPoor = gems < frame.price
  const rs = RARITY_STYLE[frame.rarity]
  const initial = (username?.trim()?.[0] ?? '?').toUpperCase()
  return (
    <GameCard className={`!p-3 ${equipped ? '!border-violet-400' : ''}`}>
      <div className="flex flex-col items-center text-center">
        <div className="h-[112px] flex items-center justify-center">
          <AvatarFrame
            type={frame.id}
            src={avatarUrl ?? undefined}
            size={74}
            fallback={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#8b5cf6', color: '#fff', fontWeight: 800, fontSize: 44 }}>{initial}</div>}
          />
        </div>
        <p className="font-extrabold text-slate-800 leading-tight mt-1">{frame.name}</p>
        <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5 mt-1" style={{ background: rs.background, color: rs.color }}>{frame.rarity}</span>
        <div className="mt-2.5 w-full">
          {owned ? (
            equipped ? (
              <Button size="sm" variant="success" className="w-full" loading={busy} onClick={() => onEquip(null)}>Ausgerüstet ✓</Button>
            ) : (
              <Button size="sm" variant="primary" className="w-full" loading={busy} onClick={() => onEquip(frame.id)}>Ausrüsten</Button>
            )
          ) : (
            <Button size="sm" variant="info" className="w-full" disabled={tooPoor || busy} loading={busy} onClick={onBuy}>
              <span className="inline-flex items-center gap-1">{tooPoor ? 'Zu wenig' : 'Kaufen'} · <Gem size={14} strokeWidth={2.5} /> {frame.price}</span>
            </Button>
          )}
        </div>
      </div>
    </GameCard>
  )
}
