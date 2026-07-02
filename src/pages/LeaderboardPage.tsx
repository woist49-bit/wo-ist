import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { levelFromXp } from '../lib/scoring'
import { Avatar } from '../components/ui/Avatar'
import { GameCard } from '../components/ui/GameCard'
import type { LeaderboardEntry } from '../types'

export function LeaderboardPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [certified, setCertified] = useState<Set<string>>(new Set())
  const [avatars, setAvatars] = useState<Map<string, string | null>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data } = worldId
        ? await supabase.rpc('world_leaderboard', { p_world_id: worldId })
        : await supabase.rpc('global_leaderboard')
      const rows = (data ?? []) as LeaderboardEntry[]
      let cert = new Set<string>()
      if (worldId) {
        const { data: m } = await supabase.from('world_members').select('user_id, certified').eq('world_id', worldId)
        cert = new Set((m ?? []).filter(x => x.certified).map(x => x.user_id))
      }
      // Profilbilder werden von den Leaderboard-RPCs nicht geliefert -> separat nachladen.
      const ids = rows.map(r => r.user_id)
      const avatarMap = new Map<string, string | null>()
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', ids)
        for (const p of profs ?? []) avatarMap.set(p.id, p.avatar_url)
      }
      if (active) {
        setEntries(rows)
        setCertified(cert)
        setAvatars(avatarMap)
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
              avatarUrl={avatars.get(entry.user_id) ?? null}
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

function LeaderboardRow({ entry, rank, isMe, certified, avatarUrl, onOpen }: { entry: LeaderboardEntry; rank: number; isMe: boolean; certified: boolean; avatarUrl: string | null; onOpen: () => void }) {
  const { level } = levelFromXp(entry.xp)
  return (
    <button onClick={onOpen} className="w-full text-left active:translate-y-[2px] transition-transform">
      <GameCard className={`!py-3 ${isMe ? '!border-violet-400' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar url={avatarUrl} name={entry.username} className="w-11 h-11 rounded-full text-lg shadow-[inset_0_2px_0_#ffffff33]" />
            <span className={`absolute -top-1.5 -left-1.5 min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center font-extrabold text-[11px] ring-2 ring-[#fdf6e3] shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${rankBadge(rank - 1)}`}>
              {rank}
            </span>
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
