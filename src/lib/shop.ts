import { Package, type LucideIcon } from 'lucide-react'

export interface ShopItem {
  key: string
  name: string
  icon: LucideIcon
  description: string
  price: number
}

// Phase 2: nur ein günstiges Platzhalter-Item, um den Kaufvorgang zu testen.
// Phase 3 ersetzt diese Liste durch die echten Items (Preise dann auch in buy_item anpassen).
export const SHOP_ITEMS: ShopItem[] = [
  {
    key: 'test_item',
    name: 'Test-Item',
    icon: Package,
    description: 'Platzhalter zum Testen des Kaufvorgangs – wird in Phase 3 durch die echten Items ersetzt.',
    price: 10,
  },
]
