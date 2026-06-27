import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/ui/Card'
import { levelFromXp } from '../lib/scoring'
import type { LeaderboardEntry } from '../types'

export function LeaderboardPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
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

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <h1 className="text-2xl font-bold text-white mb-1">{worldId ? 'Rangliste' : 'Globale Rangliste'}</h1>
      <p className="text-white/40 text-sm mb-6">{worldId ? 'Diese Spielwelt' : 'Über alle Spielwelten'}</p>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <Card className="text-center py-12 text-white/40">Noch keine Einträge</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, idx) => (
            <LeaderboardRow key={entry.user_id} entry={entry} rank={idx + 1} isMe={entry.user_id === user?.id} certified={certified.has(entry.user_id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderboardRow({ entry, rank, isMe, certified }: { entry: LeaderboardEntry; rank: number; isMe: boolean; certified: boolean }) {
  const { level } = levelFromXp(entry.xp)
  const idx = rank - 1
  const badge = idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/60'
  return (
    <Card className={isMe ? 'border-indigo-500/60 bg-indigo-900/20' : ''}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${badge}`}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold flex items-center gap-1.5 ${isMe ? 'text-indigo-300' : 'text-white'}`}>
            <span className="truncate">{entry.username}</span>
            {certified && <BadgeCheck size={15} className="text-sky-400 flex-shrink-0" aria-label="Zertifiziert" />}
            {isMe && <span className="text-white/40 text-sm flex-shrink-0">(Du)</span>}
          </div>
          <p className="text-xs text-white/40">
            Lvl {level} · {entry.wins} {entry.wins === 1 ? 'Sieg' : 'Siege'} · {entry.achievement_count} Erfolge
          </p>
        </div>
        <p className="font-bold text-white text-lg flex-shrink-0">{entry.total_points.toLocaleString()}</p>
      </div>
    </Card>
  )
}
