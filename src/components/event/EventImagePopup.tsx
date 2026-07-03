import { useState, useEffect } from 'react'
import { X, Lock, ChevronLeft, Check, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../stores/toast'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { SHOP_ITEMS, getShopItem, DEBUFF_ITEM_KEYS, PRE_ROUND_ITEM_KEYS, type ShopItem } from '../../lib/shop'
import { formatCountdown } from '../../lib/time'
import { useNow } from '../../hooks/useNow'
import type { EventImage, PlayerAttempt } from '../../types'

export type ImageStatus = 'locked' | 'open' | 'played'

interface TargetPlayer { user_id: string; username: string; avatar_url: string | null }
interface ReceivedDebuff { debuff_type: string; stacks: number; sender_username: string }

interface Props {
  image: EventImage
  index: number
  status: ImageStatus
  attempt: PlayerAttempt | null
  inventory: Map<string, number>
  onClose: () => void
  onPlay: () => void          // Bild öffnen (Navigation übernimmt der Aufrufer)
  onViewResult: () => void    // Auflösung eines bereits gespielten Bildes ansehen
  onChanged: () => void       // nach Debuff-Einsatz: Inventar/Board neu laden
}

export function EventImagePopup({ image, index, status, attempt, inventory, onClose, onPlay, onViewResult, onChanged }: Props) {
  const { addToast } = useToast()
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)

  // Vor-Runden-Items, die für DIESES Bild schon scharf gestellt wurden (nicht mehr abwählbar)
  const [armed, setArmed] = useState<Set<string>>(new Set())
  // Neu aktivierte Vor-Runden-Items (in dieser Popup-Sitzung an-/abgewählt)
  const [toggled, setToggled] = useState<Set<string>>(new Set())
  const [received, setReceived] = useState<ReceivedDebuff[]>([])

  // Debuff-Zielauswahl (nur im gesperrten Zustand)
  const [debuffItem, setDebuffItem] = useState<ShopItem | null>(null)
  const [targets, setTargets] = useState<TargetPlayer[] | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [armedRes, debuffRes] = await Promise.all([
        supabase.from('player_image_items').select('item_key').eq('image_id', image.id),
        supabase.rpc('my_image_debuffs', { p_image_id: image.id }),
      ])
      if (!active) return
      setArmed(new Set((armedRes.data ?? []).map(r => r.item_key)))
      setReceived((debuffRes.data ?? []) as ReceivedDebuff[])
    })()
    return () => { active = false }
  }, [image.id])

  const owned = (key: string) => inventory.get(key) ?? 0
  const activated = new Set([...armed, ...toggled])

  function togglePre(key: string) {
    if (armed.has(key)) return // bereits scharf gestellt -> nicht abwählbar
    setToggled(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handlePlay() {
    const keys = [...activated]
    if (keys.length > 0) {
      setBusy(true)
      const { error } = await supabase.rpc('arm_pre_round_items', { p_image_id: image.id, p_item_keys: keys })
      setBusy(false)
      if (error) { addToast('Item konnte nicht eingesetzt werden: ' + (error.message || ''), 'error', 6000); return }
    }
    onPlay()
  }

  async function openDebuffTargets(item: ShopItem) {
    setDebuffItem(item)
    setSelectedTarget(null)
    setTargets(null)
    const { data, error } = await supabase.rpc('image_debuff_targets', { p_image_id: image.id })
    if (error) {
      const m = error.message || ''
      const text = /image_debuff_targets|schema cache|does not exist|PGRST202/i.test(m)
        ? 'Zielspieler-Funktion fehlt – ist das Phase-4-SQL in Supabase ausgeführt?'
        : `Zielspieler konnten nicht geladen werden: ${m}`
      addToast(text, 'error', 7000)
      setTargets([])
      return
    }
    setTargets((data ?? []) as TargetPlayer[])
  }

  async function castDebuff() {
    if (!debuffItem || !selectedTarget) return
    setBusy(true)
    const { error } = await supabase.rpc('cast_debuff', {
      p_image_id: image.id, p_target_player_id: selectedTarget, p_debuff_type: debuffItem.key,
    })
    setBusy(false)
    if (error) {
      const m = error.message || ''
      const text = m.includes('TARGET_ALREADY_PLAYED') ? 'Dieser Spieler hat das Bild bereits gespielt.'
        : m.includes('IMAGE_NOT_LOCKED') ? 'Das Bild ist nicht mehr gesperrt.'
        : m.includes('NOT_OWNED') ? 'Du besitzt dieses Debuff-Item nicht mehr.'
        : `Debuff fehlgeschlagen: ${m}`
      addToast(text, 'error', 6000)
      return
    }
    addToast(`${debuffItem.name} eingesetzt!`, 'success')
    setDebuffItem(null); setTargets(null); setSelectedTarget(null)
    onChanged() // Inventar aktualisieren (Item abgezogen)
  }

  const unlockMs = new Date(image.unlocks_at).getTime()
  const untilUnlock = unlockMs - now

  return (
    <div className="fixed inset-0 z-[65] bg-black/60 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[88vh] bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-3xl shadow-[0_8px_0_#0000002e] flex flex-col animate-pop-in overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Kopf */}
        <div className="relative flex-shrink-0">
          <div className="h-28 bg-slate-300 overflow-hidden flex items-center justify-center">
            {status === 'locked'
              ? <div className="flex flex-col items-center text-slate-500"><Lock size={30} strokeWidth={2.5} /></div>
              : <img src={image.image_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Schließen"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
          <div className="absolute bottom-2 left-3">
            <span className="inline-block bg-black/50 text-white text-sm font-extrabold rounded-full px-3 py-1">Bild {index + 1}</span>
          </div>
        </div>

        {/* Debuff-Zielauswahl überlagert den Inhalt */}
        {debuffItem ? (
          <TargetSelection
            item={debuffItem}
            targets={targets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            onBack={() => { setDebuffItem(null); setTargets(null); setSelectedTarget(null) }}
            onConfirm={castDebuff}
            busy={busy}
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-none min-h-0 px-4 py-3">
              {status === 'locked' && (
                <>
                  <p className="text-sm font-bold text-slate-500 mb-0.5 flex items-center gap-1.5">
                    <Lock size={14} strokeWidth={2.5} /> Noch gesperrt
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Freigeschaltet in <span className="font-extrabold text-slate-700">{untilUnlock > 0 ? formatCountdown(untilUnlock) : 'Kürze'}</span>.{' '}
                    Vor der Freischaltung kannst du Debuffs auf andere Spieler legen.
                  </p>
                  <ItemList
                    inventory={inventory}
                    render={item => {
                      const isDebuff = DEBUFF_ITEM_KEYS.includes(item.key)
                      if (isDebuff) {
                        return <ItemRow key={item.key} item={item} count={owned(item.key)} tone="action" actionLabel="Einsetzen" onAction={() => openDebuffTargets(item)} />
                      }
                      return <ItemRow key={item.key} item={item} count={owned(item.key)} tone="disabled" hint="Erst nach Freischaltung einsetzbar" />
                    }}
                    empty="Du besitzt keine einsetzbaren Items. Im Shop erhältlich."
                  />
                </>
              )}

              {status === 'open' && (
                <>
                  <p className="text-sm text-slate-500 mb-3">Aktiviere Items für diese Runde und starte dann das Bild.</p>
                  <ItemList
                    inventory={inventory}
                    render={item => {
                      if (PRE_ROUND_ITEM_KEYS.includes(item.key)) {
                        return (
                          <ItemRow
                            key={item.key}
                            item={item}
                            count={owned(item.key)}
                            tone={activated.has(item.key) ? 'active' : 'toggle'}
                            locked={armed.has(item.key)}
                            onAction={() => togglePre(item.key)}
                          />
                        )
                      }
                      if (DEBUFF_ITEM_KEYS.includes(item.key)) {
                        return <ItemRow key={item.key} item={item} count={owned(item.key)} tone="disabled" hint="Nur auf gesperrte Bilder einsetzbar" />
                      }
                      return <ItemRow key={item.key} item={item} count={owned(item.key)} tone="disabled" hint="Während der Suche einsetzbar" />
                    }}
                    empty="Du besitzt keine Items. Im Shop erhältlich."
                  />
                </>
              )}

              {status === 'played' && (
                <PlayedContent attempt={attempt} armed={armed} received={received} />
              )}
            </div>

            {/* Fußbereich mit Aktion */}
            <div className="flex-shrink-0 p-4 pt-2">
              {status === 'open' && (
                <Button variant="success" size="lg" className="w-full" loading={busy} onClick={handlePlay}>
                  ▶ Spielen
                </Button>
              )}
              {status === 'locked' && (
                <div className="w-full text-center bg-slate-200 text-slate-500 font-bold rounded-2xl py-3">Noch gesperrt</div>
              )}
              {status === 'played' && (
                <Button variant="secondary" size="lg" className="w-full" onClick={onViewResult}>Auflösung ansehen</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- Zielspieler-Auswahl (Sub-View im gesperrten Zustand) ----
function TargetSelection({ item, targets, selected, onSelect, onBack, onConfirm, busy }: {
  item: ShopItem
  targets: TargetPlayer[] | null
  selected: string | null
  onSelect: (id: string) => void
  onBack: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const Icon = item.icon
  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-none min-h-0 px-4 py-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-slate-500 mb-3 active:scale-95 transition-transform">
          <ChevronLeft size={18} strokeWidth={2.5} /> Zurück
        </button>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-[0_2px_0_#b91c1c] flex-shrink-0">
            <Icon size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-800 leading-tight">{item.name}</p>
            <p className="text-xs text-slate-500">Wähle einen Zielspieler</p>
          </div>
        </div>

        {targets === null ? (
          <div className="py-8 flex justify-center"><div className="w-6 h-6 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : targets.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Kein Spieler verfügbar – alle haben das Bild schon gespielt.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {targets.map(t => {
              const sel = selected === t.user_id
              return (
                <button
                  key={t.user_id}
                  onClick={() => onSelect(t.user_id)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2 border-2 transition-colors ${sel ? 'bg-red-50 border-red-400' : 'bg-white border-transparent'}`}
                >
                  <Avatar url={t.avatar_url} name={t.username} className="w-9 h-9 rounded-full text-sm" />
                  <span className="font-bold text-slate-800 flex-1 text-left truncate">{t.username}</span>
                  {sel && <Check size={20} strokeWidth={3} className="text-red-500 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 p-4 pt-2">
        <Button variant="danger" size="lg" className="w-full" disabled={!selected || busy} loading={busy} onClick={onConfirm}>
          Debuff setzen
        </Button>
      </div>
    </>
  )
}

// ---- "bereits gespielt"-Inhalt ----
function PlayedContent({ attempt, armed, received }: { attempt: PlayerAttempt | null; armed: Set<string>; received: ReceivedDebuff[] }) {
  return (
    <>
      <div className="text-center py-2 mb-2">
        {attempt?.is_correct ? (
          <>
            <p className="text-green-600 font-extrabold text-2xl">🎉 Gefunden!</p>
            <p className="text-slate-600 font-semibold mt-1">
              {attempt.points > 0 ? <span className="text-green-600 font-extrabold">+{attempt.points} Punkte</span> : 'Keine Punkte'} · {attempt.time_seconds}s
            </p>
          </>
        ) : (
          <p className="text-red-500 font-extrabold text-2xl">💀 Daneben</p>
        )}
      </div>

      <Section title="Eingesetzte Items">
        {armed.size === 0 ? (
          <p className="text-xs text-slate-400">Keine Items eingesetzt.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...armed].map(key => {
              const it = getShopItem(key); if (!it) return null
              const Icon = it.icon
              return (
                <span key={key} className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 font-bold text-xs rounded-full pl-2 pr-3 py-1">
                  <Icon size={14} strokeWidth={2.5} /> {it.name}
                </span>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Erhaltene Debuffs">
        {received.length === 0 ? (
          <p className="text-xs text-slate-400">Keine Debuffs erhalten.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {received.map((d, i) => {
              const it = getShopItem(d.debuff_type)
              const Icon = it?.icon ?? Search
              return (
                <div key={i} className="flex items-center gap-2 bg-red-100 text-red-700 rounded-xl px-2.5 py-1.5">
                  <Icon size={16} strokeWidth={2.5} className="flex-shrink-0" />
                  <span className="font-bold text-xs flex-1">{it?.name ?? d.debuff_type}{d.stacks > 1 ? ` ×${d.stacks}` : ''}</span>
                  <span className="text-[11px] text-red-500 font-semibold">von {d.sender_username}</span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wide mb-1.5">{title}</p>
      {children}
    </div>
  )
}

// ---- Item-Liste: rendert nur besessene Items (qty > 0) ----
function ItemList({ inventory, render, empty }: {
  inventory: Map<string, number>
  render: (item: ShopItem) => React.ReactNode
  empty: string
}) {
  const owned = SHOP_ITEMS.filter(i => (inventory.get(i.key) ?? 0) > 0)
  if (owned.length === 0) return <p className="text-sm text-slate-500 text-center py-6">{empty}</p>
  return <div className="flex flex-col gap-2">{owned.map(render)}</div>
}

// ---- Eine Item-Zeile ----
function ItemRow({ item, count, tone, hint, actionLabel, locked, onAction }: {
  item: ShopItem
  count: number
  tone: 'toggle' | 'active' | 'action' | 'disabled'
  hint?: string
  actionLabel?: string
  locked?: boolean
  onAction?: () => void
}) {
  const Icon = item.icon
  const disabled = tone === 'disabled'
  const active = tone === 'active'
  const clickable = (tone === 'toggle' || tone === 'active' || tone === 'action') && !locked

  return (
    <button
      onClick={clickable ? onAction : undefined}
      disabled={!clickable}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border-2 text-left w-full transition-colors ${
        active ? 'bg-green-50 border-green-400'
        : disabled ? 'bg-slate-100 border-transparent opacity-60'
        : 'bg-white border-transparent active:border-violet-300'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[inset_0_2px_0_#ffffff4d] ${
        active ? 'bg-green-500 text-white' : disabled ? 'bg-slate-300 text-slate-500' : 'bg-violet-500 text-white'
      }`}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-extrabold ${disabled ? 'text-slate-500' : 'text-slate-800'}`}>{item.name}</p>
          <span className="text-[11px] font-extrabold text-slate-400">×{count}</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
          {hint ?? (active ? 'Aktiviert' : locked ? 'Bereits eingesetzt' : 'Tippen zum Aktivieren')}
        </p>
      </div>
      {tone === 'action' && <span className="text-xs font-extrabold text-red-500 flex-shrink-0">{actionLabel} →</span>}
      {active && <Check size={20} strokeWidth={3} className="text-green-500 flex-shrink-0" />}
    </button>
  )
}
