import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import confetti from 'canvas-confetti'
import { Medal } from 'lucide-react'
import { ACHIEVEMENT_MAP } from '../lib/achievements'
import { xpForNextLevel } from '../lib/scoring'
import { Button } from '../components/ui/Button'
import { GameCard } from '../components/ui/GameCard'

interface Banner { key: string; id: number }
interface LevelUp { newLevel: number; xpForNext: number; id: number }

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
  const [banners, setBanners] = useState<Banner[]>([])
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null)
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUp[]>([])

  const triggerAchievement = useCallback((key: string) => {
    setBanners(b => [...b, { key, id: nextId++ }])
  }, [])
  const triggerLevelUp = useCallback((newLevel: number, xpForNext: number) => {
    setLevelUpQueue(q => [...q, { newLevel, xpForNext, id: nextId++ }])
  }, [])

  const dismissBanner = useCallback((id: number) => {
    setBanners(b => b.filter(x => x.id !== id))
  }, [])

  // Level-Up-Overlay erst zeigen, wenn keine Banner mehr da sind (erst Banner, dann Overlay)
  useEffect(() => {
    if (levelUp || banners.length > 0 || levelUpQueue.length === 0) return
    setLevelUp(levelUpQueue[0])
    setLevelUpQueue(q => q.slice(1))
  }, [levelUp, banners, levelUpQueue])

  // Konfetti beim Level-Up
  useEffect(() => {
    if (levelUp) fireConfetti()
  }, [levelUp])

  return (
    <NotificationContext.Provider value={{ triggerAchievement, triggerLevelUp }}>
      {children}

      {banners.length > 0 && (
        <div
          className="fixed left-0 right-0 z-[60] px-3 flex flex-col items-center gap-2 pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
        >
          {banners.map(b => (
            <AchievementBanner key={b.id} achievementKey={b.key} onDismiss={() => dismissBanner(b.id)} />
          ))}
        </div>
      )}

      {levelUp && (
        <LevelUpOverlay newLevel={levelUp.newLevel} xpForNext={levelUp.xpForNext} onClose={() => setLevelUp(null)} />
      )}
    </NotificationContext.Provider>
  )
}

function fireConfetti() {
  const colors = ['#7c3aed', '#22c55e', '#0ea5e9', '#f59e0b', '#f43f5e']
  confetti({ particleCount: 90, angle: 270, spread: 60, startVelocity: 30, gravity: 1, ticks: 250, origin: { x: 0.5, y: 0 }, colors })
  confetti({ particleCount: 60, angle: 250, spread: 50, startVelocity: 35, gravity: 1, ticks: 250, origin: { x: 0.1, y: 0 }, colors })
  confetti({ particleCount: 60, angle: 290, spread: 50, startVelocity: 35, gravity: 1, ticks: 250, origin: { x: 0.9, y: 0 }, colors })
}

const TIER = {
  gold: { border: '#eab308', icon: 'text-yellow-500' },
  silver: { border: '#94a3b8', icon: 'text-slate-400' },
  bronze: { border: '#b45309', icon: 'text-amber-700' },
}

function AchievementBanner({ achievementKey, onDismiss }: { achievementKey: string; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true))
    const auto = setTimeout(() => setLeaving(true), 4000) // automatisch nach 4s ausblenden
    return () => { cancelAnimationFrame(r); clearTimeout(auto) }
  }, [])

  // Ausblende-Animation abwarten, dann entfernen
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onDismiss, 350)
    return () => clearTimeout(t)
  }, [leaving, onDismiss])

  const a = ACHIEVEMENT_MAP[achievementKey]
  if (!a) return null
  const tier = TIER[a.tier as keyof typeof TIER] ?? TIER.bronze
  const shown = entered && !leaving

  return (
    <button
      onClick={() => setLeaving(true)}
      className="w-full max-w-md pointer-events-auto text-left"
      style={{
        transform: shown ? 'translateY(0)' : 'translateY(-30%)',
        opacity: shown ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease-out',
      }}
    >
      <div
        className="bg-[#fdf6e3] border-[3px] rounded-2xl shadow-[0_5px_0_#0000001f] px-4 py-3 flex items-center gap-3"
        style={{ borderColor: tier.border }}
      >
        <Medal size={30} strokeWidth={2.5} className={`flex-shrink-0 ${tier.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-slate-800 truncate">{a.name}</p>
          <p className="text-xs text-slate-500">Achievement freigeschaltet</p>
        </div>
        <p className="font-extrabold text-green-600 flex-shrink-0">+{a.xp_reward} XP</p>
      </div>
    </button>
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
