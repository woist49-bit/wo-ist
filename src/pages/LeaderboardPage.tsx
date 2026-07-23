import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { levelFromXp } from '../lib/scoring'
import { FramedAvatar } from '../components/ui/FramedAvatar'
import { GameCard } from '../components/ui/GameCard'
import type { LeaderboardEntry } from '../types'
import { LeaderboardHeader, sortLeaders, type LeaderSort } from '../components/leaderboard/LeaderboardControls'

export function LeaderboardPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [certified, setCertified] = useState<Set<string>>(new Set())
  const [avatars, setAvatars] = useState<Map<string, string | null>>(new Map())
  const [frames, setFrames] = useState<Map<string, string | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<LeaderSort>('points')
  const [worldName, setWorldName] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data } = worldId
        ? await supabase.rpc('world_leaderboard', { p_world_id: worldId })
        : await supabase.rpc('global_leaderboard')
      const rows = (data ?? []) as LeaderboardEntry[]
      let cert = new Set<string>()
      let wName: string | null = null
      if (worldId) {
        const [{ data: m }, { data: w }] = await Promise.all([
          supabase.from('world_members').select('user_id, certified').eq('world_id', worldId),
          supabase.from('worlds').select('name').eq('id', worldId).single(),
        ])
        cert = new Set((m ?? []).filter(x => x.certified).map(x => x.user_id))
        wName = w?.name ?? null
      }
      // Profilbilder + Rahmen werden von den Leaderboard-RPCs nicht geliefert -> separat nachladen.
      const ids = rows.map(r => r.user_id)
      const avatarMap = new Map<string, string | null>()
      const frameMap = new Map<string, string | null>()
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, avatar_url, equipped_frame').in('id', ids)
        for (const p of profs ?? []) { avatarMap.set(p.id, p.avatar_url); frameMap.set(p.id, p.equipped_frame) }
      }
      if (active) {
        setEntries(rows)
        setCertified(cert)
        setAvatars(avatarMap)
        setFrames(frameMap)
        setWorldName(wName)
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [worldId])

  const base = worldId ? `/world/${worldId}` : ''
  // entries kommen punkte-sortiert vom RPC -> Index = echter Punkte-Platz (bleibt trotz Umsortierung).
  const pointsRank = new Map(entries.map((e, i) => [e.user_id, i + 1]))
  const sorted = sortLeaders(entries, sort)

  return (
    <div className="p-4 max-w-lg mx-auto pt-5">
      <LeaderboardHeader
        variant={worldId ? 'world' : 'global'}
        title={worldId ? (worldName ? `${worldName} – Rangliste` : 'Spielwelt-Rangliste') : undefined}
        subtitle={worldId ? 'Spielwelt' : 'Über alle Spielwelten'}
        sort={sort}
        onSort={setSort}
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <GameCard className="text-center py-12 text-slate-400 font-semibold">Noch keine Einträge</GameCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((entry) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              rank={pointsRank.get(entry.user_id) ?? 0}
              isMe={entry.user_id === user?.id}
              certified={certified.has(entry.user_id)}
              avatarUrl={avatars.get(entry.user_id) ?? null}
              frame={frames.get(entry.user_id) ?? null}
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

function LeaderboardRow({ entry, rank, isMe, certified, avatarUrl, frame, onOpen }: { entry: LeaderboardEntry; rank: number; isMe: boolean; certified: boolean; avatarUrl: string | null; frame: string | null; onOpen: () => void }) {
  const { level } = levelFromXp(entry.xp)
  return (
    <button onClick={onOpen} className="w-full text-left active:translate-y-[2px] transition-transform">
      <GameCard className={`!py-3 ${isMe ? '!border-violet-400' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <FramedAvatar url={avatarUrl} name={entry.username} frame={frame} size={44} paused={false} className="text-lg shadow-[inset_0_2px_0_#ffffff33]" />
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
