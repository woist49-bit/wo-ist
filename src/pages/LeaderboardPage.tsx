import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { levelFromXp } from '../lib/scoring'
import { GameCard } from '../components/ui/GameCard'
import type { LeaderboardEntry } from '../types'

export function LeaderboardPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [certified, setCertified] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data } = worldId
        ? await supabase.rpc('world_leaderboard', { p_world_id: worldId })
        : await supabase.rpc('global_leaderboard')
      let cert = new Set<string>()
      if (worldId) {
        const { data: m } = await supabase.from('world_members').select('user_id, certified').eq('world_id', worldId)
        cert = new Set((m ?? []).filter(x => x.certified).map(x => x.user_id))
      }
      if (active) {
        setEntries(data ?? [])
        setCertified(cert)
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [worldId])

  const base = worldId ? `/world/${worldId}` : ''

  return (
    <div className="p-4 max-w-lg mx-auto pt-5">
      <h1 className="text-2xl font-extrabold text-white mb-1">{worldId ? 'Rangliste' : 'Globale Rangliste'}</h1>
      <p className="text-white/50 text-sm mb-5">{worldId ? 'Diese Spielwelt' : 'Über alle Spielwelten'}</p>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <GameCard className="text-center py-12 text-slate-400 font-semibold">Noch keine Einträge</GameCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry, idx) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              rank={idx + 1}
              isMe={entry.user_id === user?.id}
              certified={certified.has(entry.user_id)}
              onOpen={() => navigate(`${base}/profile/${entry.user_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const rankBadge = (idx: number) =>
  idx === 0 ? 'bg-yellow-400 text-yellow-900'
  : idx === 1 ? 'bg-slate-300 text-slate-700'
  : idx === 2 ? 'bg-amber-600 text-white'
  : 'bg-slate-200 text-slate-500'

function LeaderboardRow({ entry, rank, isMe, certified, onOpen }: { entry: LeaderboardEntry; rank: number; isMe: boolean; certified: boolean; onOpen: () => void }) {
  const { level } = levelFromXp(entry.xp)
  return (
    <button onClick={onOpen} className="w-full text-left active:translate-y-[2px] transition-transform">
      <GameCard className={`!py-3 ${isMe ? '!border-violet-400' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-[inset_0_1px_0_#ffffff80] ${rankBadge(rank - 1)}`}>
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-800 truncate">{entry.username}</span>
              {certified && <BadgeCheck size={15} className="text-sky-500 flex-shrink-0" aria-label="Zertifiziert" />}
              {isMe && <span className="text-xs text-slate-400 flex-shrink-0">(Du)</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Lvl {level} · {entry.wins} {entry.wins === 1 ? 'Sieg' : 'Siege'} · {entry.achievement_count} Erfolge
            </p>
          </div>
          <p className="font-extrabold text-slate-800 text-lg flex-shrink-0">{entry.total_points.toLocaleString()}</p>
        </div>
      </GameCard>
    </button>
  )
}
