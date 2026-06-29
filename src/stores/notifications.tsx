import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import confetti from 'canvas-confetti'
import { Medal } from 'lucide-react'
import { ACHIEVEMENT_MAP } from '../lib/achievements'
import { xpForNextLevel } from '../lib/scoring'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'

type Item =
  | { kind: 'achievement'; key: string; id: number }
  | { kind: 'levelup'; newLevel: number; xpForNext: number; id: number }

interface Ctx {
  triggerAchievement: (key: string) => void
  triggerLevelUp: (newLevel: number, xpForNext: number) => void
}

const NotificationContext = createContext<Ctx | null>(null)

export function useNotifications(): Ctx {
  const c = useContext(NotificationContext)
  if (!c) throw new Error('useNotifications must be used within NotificationProvider')
  return c
}

let nextId = 1

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Item[]>([])
  const [current, setCurrent] = useState<Item | null>(null)
  const [bannerPhase, setBannerPhase] = useState<'in' | 'out'>('in')

  const triggerAchievement = useCallback((key: string) => {
    setQueue(q => [...q, { kind: 'achievement', key, id: nextId++ }])
  }, [])
  const triggerLevelUp = useCallback((newLevel: number, xpForNext: number) => {
    setQueue(q => [...q, { kind: 'levelup', newLevel, xpForNext, id: nextId++ }])
  }, [])

  // Nächstes Element auswählen, sobald gerade nichts angezeigt wird.
  // Achievements werden vor Level-Up-Overlays bevorzugt.
  useEffect(() => {
    if (current || queue.length === 0) return
    const achIdx = queue.findIndex(i => i.kind === 'achievement')
    const idx = achIdx >= 0 ? achIdx : 0
    const next = queue[idx]
    setQueue(q => q.filter(i => i.id !== next.id))
    setCurrent(next)
  }, [current, queue])

  // Achievement-Banner: rein, 4s stehen, raus, dann freigeben (mit kleinem Abstand)
  useEffect(() => {
    if (!current || current.kind !== 'achievement') return
    setBannerPhase('in')
    const tOut = setTimeout(() => setBannerPhase('out'), 4000)
    const tClear = setTimeout(() => setCurrent(null), 4000 + 550)
    return () => { clearTimeout(tOut); clearTimeout(tClear) }
  }, [current])

  // Konfetti beim Level-Up
  useEffect(() => {
    if (current?.kind === 'levelup') fireConfetti()
  }, [current])

  return (
    <NotificationContext.Provider value={{ triggerAchievement, triggerLevelUp }}>
      {children}
      {current?.kind === 'achievement' && (
        <AchievementBanner key={current.id} achievementKey={current.key} phase={bannerPhase} />
      )}
      {current?.kind === 'levelup' && (
        <LevelUpOverlay newLevel={current.newLevel} xpForNext={current.xpForNext} onClose={() => setCurrent(null)} />
      )}
    </NotificationContext.Provider>
  )
}

function fireConfetti() {
  const colors = ['#7c3aed', '#22c55e', '#0ea5e9', '#f59e0b', '#f43f5e']
  // Vom oberen Rand nach unten "regnen"
  confetti({ particleCount: 90, angle: 270, spread: 60, startVelocity: 30, gravity: 1, ticks: 250, origin: { x: 0.5, y: 0 }, colors })
  confetti({ particleCount: 60, angle: 250, spread: 50, startVelocity: 35, gravity: 1, ticks: 250, origin: { x: 0.1, y: 0 }, colors })
  confetti({ particleCount: 60, angle: 290, spread: 50, startVelocity: 35, gravity: 1, ticks: 250, origin: { x: 0.9, y: 0 }, colors })
}

const TIER = {
  gold: { border: '#eab308', icon: 'text-yellow-500' },
  silver: { border: '#94a3b8', icon: 'text-slate-400' },
  bronze: { border: '#b45309', icon: 'text-amber-700' },
}

function AchievementBanner({ achievementKey, phase }: { achievementKey: string; phase: 'in' | 'out' }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(r)
  }, [])

  const a = ACHIEVEMENT_MAP[achievementKey]
  if (!a) return null
  const tier = TIER[a.tier as keyof typeof TIER] ?? TIER.bronze
  const visible = entered && phase === 'in'

  return (
    <div
      className="fixed left-0 right-0 z-[60] px-3 flex justify-center pointer-events-none"
      style={{
        top: 'calc(env(safe-area-inset-top) + 4.5rem)',
        transform: visible ? 'translateY(0)' : 'translateY(-240%)',
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        className="w-full max-w-md bg-[#fdf6e3] border-[3px] rounded-2xl shadow-[0_5px_0_#0000001f] px-4 py-3 flex items-center gap-3"
        style={{ borderColor: tier.border }}
      >
        <Medal size={30} strokeWidth={2.5} className={`flex-shrink-0 ${tier.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-slate-800 truncate">{a.name}</p>
          <p className="text-xs text-slate-500">Achievement freigeschaltet</p>
        </div>
        <p className="font-extrabold text-green-600 flex-shrink-0">+{a.xp_reward} XP</p>
      </div>
    </div>
  )
}

function LevelUpOverlay({ newLevel, xpForNext, onClose }: { newLevel: number; xpForNext: number; onClose: () => void }) {
  const [displayLevel, setDisplayLevel] = useState(Math.max(1, newLevel - 1))

  useEffect(() => {
    const from = Math.max(1, newLevel - 1)
    const start = performance.now()
    const dur = 700
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setDisplayLevel(Math.round(from + (newLevel - from) * t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [newLevel])

  const xpNeeded = xpForNextLevel(newLevel)
  const progress = Math.max(0, Math.min(100, Math.round(((xpNeeded - xpForNext) / xpNeeded) * 100)))

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-6">
      <GameCard className="w-full max-w-xs text-center !p-6 animate-pop-in">
        <p className="text-2xl font-extrabold text-violet-600">🎉 Level Up!</p>
        <p className="text-7xl font-extrabold text-slate-800 my-3 leading-none">{displayLevel}</p>
        <div className="flex justify-between text-xs text-slate-500 font-semibold mb-1">
          <span>Bis Level {newLevel + 1}</span>
          <span>noch {xpForNext.toLocaleString()} XP</span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-green-500 rounded-full shadow-[inset_0_1px_0_#ffffff80] transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <Button variant="success" size="lg" className="w-full" onClick={onClose}>Weiter</Button>
      </GameCard>
    </div>
  )
}
