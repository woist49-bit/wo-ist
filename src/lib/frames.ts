import type { FrameType } from '../components/ui/AvatarFrame'

// Nur drei Seltenheiten (Basis/Winter entfernt). Farben: Selten=blau, Episch=lila, Legendär=gold.
export type Rarity = 'Selten' | 'Episch' | 'Legendär'

export interface FrameDef {
  id: FrameType
  name: string
  rarity: Rarity
  price: number // in Gems
}

// Katalog der verfügbaren Rahmen. Muss 1:1 mit der `frames`-Tabelle in Supabase
// übereinstimmen (siehe SCHRITT 13 im supabase_schema.sql).
export const FRAMES: FrameDef[] = [
  { id: 'stars', name: 'Sternenreigen', rarity: 'Selten', price: 50 },
  { id: 'sparkle', name: 'Funkelstaub', rarity: 'Selten', price: 50 },
  { id: 'snow', name: 'Schneegestöber', rarity: 'Selten', price: 50 },
  { id: 'confetti', name: 'Party-Regen', rarity: 'Selten', price: 50 },
  { id: 'hearts', name: 'Herzenkranz', rarity: 'Selten', price: 50 },
  { id: 'pulse', name: 'Herzschlag', rarity: 'Episch', price: 150 },
  { id: 'beer', name: 'Prost!', rarity: 'Legendär', price: 550 },
  { id: 'aurora', name: 'Polarlicht', rarity: 'Legendär', price: 550 },
  { id: 'fire', name: 'Feuersturm', rarity: 'Legendär', price: 550 },
]

export const FRAME_MAP: Record<string, FrameDef> = Object.fromEntries(FRAMES.map(f => [f.id, f]))
export const isFrameId = (v: string | null | undefined): v is FrameType => !!v && v in FRAME_MAP

export const RARITY_STYLE: Record<Rarity, { background: string; color: string }> = {
  Selten: { background: '#e4ecfb', color: '#3f6fd6' },     // blau
  Episch: { background: '#efe6fb', color: '#8250d6' },     // lila
  Legendär: { background: '#fbf1dd', color: '#c69320' },   // gold
}

// Reihenfolge für die Shop-Sortierung
export const RARITY_ORDER: Record<Rarity, number> = { Selten: 0, Episch: 1, Legendär: 2 }
