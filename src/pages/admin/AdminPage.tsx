import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck, MoreVertical } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { levelFromXp } from '../../lib/scoring'
import { FramedAvatar } from '../../components/ui/FramedAvatar'
import { Button } from '../../components/ui/Button'
import { GameCard } from '../../components/ui/GameCard'
import { Input } from '../../components/ui/Input'
import type { WorldMember, LiveEvent, Profile, Campaign, World } from '../../types'

type Member = WorldMember & { profile: Profile }

const LIGHT_AREA = 'w-full bg-white border-2 border-[#e6d3a3] rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition resize-none'

export function AdminPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[]>([])
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [memberDialog, setMemberDialog] = useState<{ type: 'promote' | 'demote' | 'remove'; member: Member } | null>(null)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [tab, setTab] = useState<'events' | 'members' | 'campaigns' | 'settings'>('events')
  const [loading, setLoading] = useState(true)

  // Create event form
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newReleaseTime, setNewReleaseTime] = useState('09:00')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Spielwelt-Einstellungen
  const [settingsDesc, setSettingsDesc] = useState('')
  const [settingsLink, setSettingsLink] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => { load() }, [worldId])

  async function load() {
    const [membRes, evRes, campRes, worldRes] = await Promise.all([
      supabase.from('world_members').select('*, profile:profiles(*)').eq('world_id', worldId),
      supabase.from('live_events').select('*').eq('world_id', worldId).order('starts_at', { ascending: false }),
      supabase.from('campaigns').select('*').eq('world_id', worldId).order('created_at', { ascending: false }),
      supabase.from('worlds').select('*').eq('id', worldId).single(),
    ])
    setMembers((membRes.data ?? []) as (WorldMember & { profile: Profile })[])
    setEvents(evRes.data ?? [])
    setCampaigns(campRes.data ?? [])
    const world = worldRes.data as World | null
    setSettingsDesc(world?.description ?? '')
    setSettingsLink(world?.whatsapp_link ?? '')
    setLoading(false)
  }

  async function saveSettings() {
    setSettingsError(''); setSettingsSaved(false)
    const link = settingsLink.trim()
    // Akzeptierte WhatsApp-Link-Formate (Gruppe, Kanal, Einladung)
    const validPrefixes = [
      'https://chat.whatsapp.com/',
      'https://www.whatsapp.com/channel/',
      'https://chat.whatsapp.com/invite/',
    ]
    if (link && !validPrefixes.some(p => link.startsWith(p))) {
      setSettingsError('Bitte gib einen gültigen WhatsApp-Link ein.')
      return
    }
    setSettingsSaving(true)
    const { error: err } = await supabase.from('worlds').update({
      description: settingsDesc.trim() || null,
      whatsapp_link: link || null,
    }).eq('id', worldId)
    setSettingsSaving(false)
    if (err) { setSettingsError(err.message); return }
    setSettingsSaved(true)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Kampagne wirklich löschen? (Bei Legacy-Kampagnen werden auch die Bilder gelöscht)')) return
    await supabase.from('campaigns').delete().eq('id', id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  async function createEvent() {
    if (!user || !newTitle || !newStartDate || !newEndDate) {
      setError('Titel, Start- und Enddatum erforderlich.')
      return
    }
    if (new Date(newStartDate) >= new Date(newEndDate)) {
      setError('Enddatum muss nach Startdatum liegen.')
      return
    }
    setCreating(true)
    setError('')

    const [hours, minutes] = newReleaseTime.split(':').map(Number)
    const startsAt = new Date(`${newStartDate}T${newReleaseTime}:00`).toISOString()
    const endsAt = new Date(`${newEndDate}T${newReleaseTime}:00`).toISOString()

    const { data, error: err } = await supabase.from('live_events').insert({
      world_id: worldId,
      title: newTitle,
      description: newDescription || null,
      starts_at: startsAt,
      ends_at: endsAt,
      daily_release_hour: hours,
      daily_release_minute: minutes,
      status: 'draft',
      created_by: user.id,
    }).select().single()

    setCreating(false)
    if (err) { setError(err.message); return }
    if (data) {
      setNewTitle(''); setNewDescription(''); setNewStartDate(''); setNewEndDate(''); setNewReleaseTime('09:00')
      navigate(`/world/${worldId}/admin/event/${data.id}`)
    }
  }

  async function toggleCertify(m: Member) {
    const next = !m.certified
    await supabase.from('world_members').update({ certified: next }).eq('world_id', worldId).eq('user_id', m.user_id)
    setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, certified: next } : x))
  }

  async function confirmPromote() {
    if (!memberDialog) return
    const id = memberDialog.member.user_id
    await supabase.from('world_members').update({ role: 'admin' }).eq('world_id', worldId).eq('user_id', id)
    setMembers(prev => prev.map(x => x.user_id === id ? { ...x, role: 'admin' } : x))
    setMemberDialog(null); setMenuOpen(null)
  }

  async function confirmDemote() {
    if (!memberDialog) return
    const id = memberDialog.member.user_id
    await supabase.from('world_members').update({ role: 'user' }).eq('world_id', worldId).eq('user_id', id)
    setMembers(prev => prev.map(x => x.user_id === id ? { ...x, role: 'user' } : x))
    setMemberDialog(null); setMenuOpen(null)
  }

  async function confirmRemove() {
    if (!memberDialog) return
    const id = memberDialog.member.user_id
    await supabase.from('world_members').delete().eq('world_id', worldId).eq('user_id', id)
    setMembers(prev => prev.filter(x => x.user_id !== id))
    setMemberDialog(null); setMenuOpen(null)
  }

  async function finishEvent(eventId: string) {
    if (!confirm('Event beenden und als Kampagne archivieren?')) return
    const ev = events.find(e => e.id === eventId)
    await supabase.from('live_events').update({ status: 'finished' }).eq('id', eventId)
    if (ev) {
      await supabase.from('campaigns').insert({ world_id: worldId, title: ev.title, original_event_id: eventId, is_legacy: false })
    }
    load()
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Event wirklich löschen? (Alle Bilder und Versuche werden gelöscht)')) return
    await supabase.from('live_events').delete().eq('id', eventId)
    load()
  }

  if (loading) return <LoadingScreen />

  const tabs = ['events', 'members', 'campaigns', 'settings'] as const
  const tabLabel: Record<typeof tabs[number], string> = { events: 'Events', members: 'Spieler', campaigns: 'Kampagnen', settings: 'Welt' }

  return (
    <div className="p-4 max-w-lg mx-auto pt-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">Admin-Bereich</h1>

      <div className="flex rounded-2xl bg-[#efe2c4] p-1 mb-5">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t ? 'bg-violet-500 text-white shadow-[0_2px_0_#5b21b6]' : 'text-slate-500'}`}>
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="flex flex-col gap-4">
          <GameCard>
            <h2 className="font-extrabold text-slate-800 mb-3">Neues Live-Event</h2>
            <div className="flex flex-col gap-3">
              <Input tone="light" label="Titel" placeholder="z. B. Urlaub 2026" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">Beschreibung (optional)</label>
                <textarea
                  placeholder="z. B. 10 Tage Abenteuer in der Südsee!"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className={LIGHT_AREA}
                  rows={2}
                />
              </div>
              <Input tone="light" label="Startdatum" type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
              <Input tone="light" label="Enddatum" type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
              <Input tone="light" label="Uhrzeit (tägliche Freischaltung)" type="time" value={newReleaseTime} onChange={e => setNewReleaseTime(e.target.value)} />
              {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
              <Button variant="success" loading={creating} onClick={createEvent} className="w-full">Event erstellen</Button>
            </div>
          </GameCard>

          {events.map(ev => (
            <GameCard key={ev.id}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="font-extrabold text-slate-800 truncate">{ev.title}</p>
                <StatusBadge status={ev.status} />
              </div>
              <p className="text-xs text-slate-500 mb-3">{formatDate(ev.starts_at)} – {formatDate(ev.ends_at)}</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => navigate(`/world/${worldId}/admin/event/${ev.id}`)}>Verwalten</Button>
                {ev.status === 'active' && <Button size="sm" variant="danger" onClick={() => finishEvent(ev.id)}>Beenden</Button>}
                <Button size="sm" variant="danger" onClick={() => deleteEvent(ev.id)}>✕</Button>
              </div>
            </GameCard>
          ))}
        </div>
      )}

      {tab === 'members' && (() => {
        const adminCount = members.filter(m => m.role === 'admin').length
        return (
          <div className="flex flex-col gap-2">
            {members.map(m => {
              const isMe = m.user_id === user?.id
              const lvl = levelFromXp(m.profile?.global_xp ?? 0).level
              const canSelfDemote = isMe && m.role === 'admin' && adminCount > 1
              return (
                <GameCard key={m.user_id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FramedAvatar url={m.profile?.avatar_url} name={m.profile?.username} frame={m.profile?.equipped_frame} size={44} paused={false} className="text-base shadow-[inset_0_2px_0_#ffffff33]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-slate-800 truncate">{m.profile?.username}</p>
                          {m.certified && <BadgeCheck size={16} className="text-sky-500 flex-shrink-0" aria-label="Zertifiziert" />}
                          {isMe && <span className="text-xs text-slate-400 flex-shrink-0">(Du)</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Level {lvl} · {m.role === 'admin' ? '👑 Admin' : 'Spieler'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMenuOpen(menuOpen === m.user_id ? null : m.user_id)}
                      className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shadow-[0_2px_0_#94a3b8] active:translate-y-[1px] transition-all"
                      aria-label="Aktionen"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>

                  {menuOpen === m.user_id && (
                    <div className="mt-3 pt-3 border-t border-black/10 flex flex-col gap-2">
                      {isMe ? (
                        canSelfDemote
                          ? <Button size="sm" variant="secondary" onClick={() => setMemberDialog({ type: 'demote', member: m })}>Admin-Rolle abgeben</Button>
                          : <p className="text-xs text-slate-500 text-center py-1">Du bist der einzige Admin – keine Aktionen für dich verfügbar.</p>
                      ) : (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => toggleCertify(m)}>
                            {m.certified ? 'Zertifizierung entfernen' : 'Zertifizieren'}
                          </Button>
                          {m.role === 'admin'
                            ? <Button size="sm" variant="info" onClick={() => setMemberDialog({ type: 'demote', member: m })}>Zu Spieler herabstufen</Button>
                            : <Button size="sm" variant="info" onClick={() => setMemberDialog({ type: 'promote', member: m })}>Zu Admin befördern</Button>}
                          <Button size="sm" variant="danger" onClick={() => setMemberDialog({ type: 'remove', member: m })}>Aus Spielwelt entfernen</Button>
                        </>
                      )}
                    </div>
                  )}
                </GameCard>
              )
            })}
          </div>
        )
      })()}

      {tab === 'campaigns' && (
        <div className="flex flex-col gap-4">
          <GameCard>
            <h2 className="font-extrabold text-slate-800 mb-1">Legacy-Kampagne anlegen</h2>
            <p className="text-xs text-slate-500 mb-3">Für vergangene Runden. Jeder Spieler bekommt beim ersten Durchspielen reguläre Punkte.</p>
            <LegacyCampaignForm worldId={worldId!} onCreated={id => navigate(`/world/${worldId}/admin/campaign/${id}`)} />
          </GameCard>

          {campaigns.length === 0 ? (
            <GameCard className="text-center py-8 text-slate-400 text-sm">Noch keine Kampagnen</GameCard>
          ) : (
            campaigns.map(c => (
              <GameCard key={c.id}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="font-extrabold text-slate-800 truncate">{c.title}</p>
                  {c.is_legacy
                    ? <span className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Legacy</span>
                    : <span className="text-[11px] font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">aus Event</span>}
                </div>
                <div className="flex gap-2">
                  {c.is_legacy ? (
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/world/${worldId}/admin/campaign/${c.id}`)}>Bilder verwalten</Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => c.original_event_id && navigate(`/world/${worldId}/admin/event/${c.original_event_id}`)}>Original-Event</Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => deleteCampaign(c.id)}>✕</Button>
                </div>
              </GameCard>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <GameCard>
          <h2 className="font-extrabold text-slate-800 mb-3">Spielwelt-Einstellungen</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">Beschreibung</label>
              <textarea
                placeholder="Worum geht's in dieser Spielwelt?"
                value={settingsDesc}
                onChange={e => { setSettingsDesc(e.target.value); setSettingsSaved(false) }}
                rows={2}
                className={LIGHT_AREA}
              />
            </div>
            <Input
              tone="light"
              label="WhatsApp-Gruppenlink"
              placeholder="https://chat.whatsapp.com/..."
              value={settingsLink}
              onChange={e => { setSettingsLink(e.target.value); setSettingsSaved(false) }}
              autoCapitalize="none"
            />
            <p className="text-xs text-slate-500 -mt-1">Über den Chat-Button in der Tab-Bar erreichbar. Leer lassen = kein Chat.</p>
            {settingsError && <p className="text-red-600 text-sm font-medium">{settingsError}</p>}
            {settingsSaved && <p className="text-green-600 text-sm font-medium">✓ Gespeichert</p>}
            <Button variant="success" loading={settingsSaving} onClick={saveSettings} className="w-full">Speichern</Button>
          </div>
        </GameCard>
      )}

      {memberDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <GameCard className="w-full max-w-sm">
            <p className="font-extrabold text-slate-800 text-lg mb-1">
              {memberDialog.type === 'promote' ? 'Zum Admin ernennen?'
                : memberDialog.type === 'demote' ? 'Herabstufen?'
                : 'Wirklich entfernen?'}
            </p>
            <p className="text-slate-600 text-sm mb-4">
              {memberDialog.type === 'promote'
                ? `Möchtest du ${memberDialog.member.profile?.username} zum Admin ernennen? Er erhält dann alle Admin-Rechte in dieser Spielwelt.`
                : memberDialog.type === 'demote'
                  ? (memberDialog.member.user_id === user?.id
                      ? 'Möchtest du deine Admin-Rolle abgeben? Du wirst dann zum normalen Spieler.'
                      : `Möchtest du ${memberDialog.member.profile?.username} die Admin-Rolle entziehen? ${memberDialog.member.profile?.username} wird dann zum normalen Spieler.`)
                  : `Möchtest du ${memberDialog.member.profile?.username} wirklich aus der Spielwelt entfernen? Er kann danach nicht mehr auf diese Spielwelt zugreifen.`}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setMemberDialog(null)}>Abbrechen</Button>
              {memberDialog.type === 'promote'
                ? <Button variant="info" className="flex-1" onClick={confirmPromote}>Bestätigen</Button>
                : memberDialog.type === 'demote'
                  ? <Button variant="info" className="flex-1" onClick={confirmDemote}>Herabstufen</Button>
                  : <Button variant="danger" className="flex-1" onClick={confirmRemove}>Entfernen</Button>}
            </div>
          </GameCard>
        </div>
      )}
    </div>
  )
}

function LegacyCampaignForm({ worldId, onCreated }: { worldId: string; onCreated: (campaignId: string) => void }) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  async function create() {
    if (!title) return
    setLoading(true)
    const { data } = await supabase.from('campaigns').insert({ world_id: worldId, title, original_event_id: null, is_legacy: true }).select().single()
    setTitle('')
    setLoading(false)
    if (data) onCreated(data.id)
  }

  return (
    <div className="flex gap-2">
      <Input tone="light" placeholder="Urlaub 2022" value={title} onChange={e => setTitle(e.target.value)} className="flex-1" />
      <Button variant="success" loading={loading} onClick={create} disabled={!title}>Anlegen</Button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-200 text-slate-600',
    active: 'bg-green-100 text-green-700',
    finished: 'bg-slate-100 text-slate-400',
  }
  const labels: Record<string, string> = { draft: 'Entwurf', active: 'Aktiv', finished: 'Beendet' }
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${map[status] ?? ''}`}>{labels[status] ?? status}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
