import { Search, Zap, Hourglass, TimerOff, EyeOff, type LucideIcon } from 'lucide-react'

// during = während der Suche einsetzbar (Phase 6)
// pre    = vor der Runde aktivierbar (Phase 4)
// debuff = auf gesperrte Bilder anderer Spieler einsetzbar (Phase 4/5)
export type ItemCategory = 'during' | 'pre' | 'debuff'

export interface ShopItem {
  key: string
  name: string
  icon: LucideIcon
  description: string
  price: number
  category: ItemCategory
}

// Alle Items sind einmalig einsetzbar und stapelbar kaufbar (jeder Kauf = ein weiterer Einsatz).
// WICHTIG: Die Preise müssen mit der Preisliste in der buy_item-RPC übereinstimmen.
export const SHOP_ITEMS: ShopItem[] = [
  {
    key: 'magnifier',
    name: 'Lupe',
    icon: Search,
    price: 150,
    category: 'during',
    description: 'Zeigt die ungefähre Position der gesuchten Person im Bild. Einsetzbar während der Suche.',
  },
  {
    key: 'double_points',
    name: 'Doppelte Punkte',
    icon: Zap,
    price: 220,
    category: 'pre',
    description: 'Deine Punkte werden verdoppelt falls du die Person findest. Gilt für das gesamte Bild.',
  },
  {
    key: 'slow_motion',
    name: 'Zeitlupe',
    icon: Hourglass,
    price: 280,
    category: 'pre',
    description: 'Dein Timer läuft in den ersten 10 Sekunden halb so schnell.',
  },
  {
    key: 'timer_debuff',
    name: 'Timer-Debuff',
    icon: TimerOff,
    price: 180,
    category: 'debuff',
    description: 'Der Timer eines anderen Spielers läuft in den ersten 10 Sekunden doppelt so schnell. Nur auf gesperrte Bilder einsetzbar.',
  },
  {
    key: 'blur_debuff',
    name: 'Unschärfe-Debuff',
    icon: EyeOff,
    price: 180,
    category: 'debuff',
    description: 'Das Bild eines anderen Spielers flackert in den ersten 10 Sekunden dreimal unscharf je circa 1 Sekunde. Nur auf gesperrte Bilder einsetzbar.',
  },
]

export const SHOP_ITEM_MAP: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map(i => [i.key, i]))

export const getShopItem = (key: string): ShopItem | undefined => SHOP_ITEM_MAP[key]

// Item-Keys nach Kategorie (müssen mit den serverseitigen RPCs übereinstimmen)
export const PRE_ROUND_ITEM_KEYS = SHOP_ITEMS.filter(i => i.category === 'pre').map(i => i.key)
export const DEBUFF_ITEM_KEYS = SHOP_ITEMS.filter(i => i.category === 'debuff').map(i => i.key)
export const DURING_ITEM_KEYS = SHOP_ITEMS.filter(i => i.category === 'during').map(i => i.key)
