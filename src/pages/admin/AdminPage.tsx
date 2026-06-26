import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { WorldMember, LiveEvent, Profile, Campaign, World } from '../../types'

export function AdminPage() {
  const { worldId } = useParams<{ worldId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<(WorldMember & { profile: Profile })[]>([])
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
    if (link && !link.startsWith('https://chat.whatsapp.com/')) {
      setSettingsError('Bitte gib einen gültigen WhatsApp-Gruppenlink ein.')
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
    // Kombiniere Datum mit Uhrzeit
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
      setNewTitle('')
      setNewDescription('')
      setNewStartDate('')
      setNewEndDate('')
      setNewReleaseTime('09:00')
      navigate(`/world/${worldId}/admin/event/${data.id}`)
    }
  }

  async function kickMember(memberId: string) {
    if (!confirm('Spieler wirklich entfernen?')) return
    await supabase.from('world_members').delete().eq('world_id', worldId).eq('user_id', memberId)
    setMembers(m => m.filter(x => x.user_id !== memberId))
  }

  async function finishEvent(eventId: string) {
    if (!confirm('Event beenden und als Kampagne archivieren?')) return
    const ev = events.find(e => e.id === eventId)
    await supabase.from('live_events').update({ status: 'finished' }).eq('id', eventId)
    if (ev) {
      await supabase.from('campaigns').insert({
        world_id: worldId,
        title: ev.title,
        original_event_id: eventId,
        is_legacy: false,
      })
    }
    load()
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Event wirklich löschen? (Alle Bilder und Versuche werden gelöscht)')) return
    await supabase.from('live_events').delete().eq('id', eventId)
    load()
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="p-4 max-w-lg mx-auto pt-6">
      <button onClick={() => navigate(`/world/${worldId}`)} className="text-white/40 text-sm mb-4 hover:text-white/70">← Zurück</button>
      <h1 className="text-2xl font-bold text-white mb-6">Admin-Bereich</h1>

      <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
        {(['events', 'members', 'campaigns', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'}`}>
            {t === 'events' ? 'Events' : t === 'members' ? 'Spieler' : t === 'campaigns' ? 'Kampagnen' : 'Welt'}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-semibold text-white mb-3">Neues Live-Event</h2>
            <div className="flex flex-col gap-3">
              <Input label="Titel" placeholder="z. B. Urlaub 2026" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
              <div>
                <label className="text-sm font-medium text-white/70 mb-1 block">Beschreibung (optional)</label>
                <textarea
                  placeholder="z. B. 10 Tage Abenteuer in der Südsee!"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                  rows={2}
                />
              </div>
              <Input label="Startdatum" type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
              <Input label="Enddatum" type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
              <Input label="Uhrzeit (tägliche Freischaltung)" type="time" value={newReleaseTime} onChange={e => setNewReleaseTime(e.target.value)} />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button loading={creating} onClick={createEvent} className="w-full">
                Event erstellen
              </Button>
            </div>
          </Card>

          {events.map(ev => (
            <Card key={ev.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-white">{ev.title}</p>
                <StatusBadge status={ev.status} />
              </div>
              <p className="text-xs text-white/40 mb-3">{formatDate(ev.starts_at)} – {formatDate(ev.ends_at)}</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => navigate(`/world/${worldId}/admin/event/${ev.id}`)}>
                  Verwalten
                </Button>
                {ev.status === 'active' && <Button size="sm" variant="danger" onClick={() => finishEvent(ev.id)}>Beenden</Button>}
                <Button size="sm" variant="danger" onClick={() => deleteEvent(ev.id)}>✕</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="flex flex-col gap-2">
          {members.map(m => (
            <Card key={m.user_id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{m.profile?.username}</p>
                  <p className="text-xs text-white/40">{m.role === 'admin' ? '👑 Admin' : 'Spieler'}</p>
                </div>
                {m.user_id !== user?.id && m.role !== 'admin' && (
                  <Button size="sm" variant="danger" onClick={() => kickMember(m.user_id)}>Entfernen</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-semibold text-white mb-1">Legacy-Kampagne anlegen</h2>
            <p className="text-xs text-white/40 mb-3">Für vergangene Runden. Jeder Spieler bekommt beim ersten Durchspielen reguläre Punkte.</p>
            <LegacyCampaignForm worldId={worldId!} onCreated={id => navigate(`/world/${worldId}/admin/campaign/${id}`)} />
          </Card>

          {campaigns.length === 0 ? (
            <Card className="text-center py-8 text-white/30 text-sm">Noch keine Kampagnen</Card>
          ) : (
            campaigns.map(c => (
              <Card key={c.id}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{c.title}</p>
                    {c.is_legacy
                      ? <span className="text-xs text-amber-400 border border-amber-400/40 rounded-full px-2 py-0.5">Legacy</span>
                      : <span className="text-xs text-white/40 border border-white/20 rounded-full px-2 py-0.5">aus Event</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.is_legacy ? (
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/world/${worldId}/admin/campaign/${c.id}`)}>
                      Bilder verwalten
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => c.original_event_id && navigate(`/world/${worldId}/admin/event/${c.original_event_id}`)}>
                      Original-Event
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => deleteCampaign(c.id)}>✕</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-semibold text-white mb-3">Spielwelt-Einstellungen</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-white/70 mb-1 block">Beschreibung</label>
                <textarea
                  placeholder="Worum geht's in dieser Spielwelt?"
                  value={settingsDesc}
                  onChange={e => { setSettingsDesc(e.target.value); setSettingsSaved(false) }}
                  rows={2}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
              </div>
              <Input
                label="WhatsApp-Gruppenlink"
                placeholder="https://chat.whatsapp.com/..."
                value={settingsLink}
                onChange={e => { setSettingsLink(e.target.value); setSettingsSaved(false) }}
                autoCapitalize="none"
              />
              <p className="text-xs text-white/40 -mt-1">Über den Chat-Button in der Tab-Bar erreichbar. Leer lassen = kein Chat.</p>
              {settingsError && <p className="text-red-400 text-sm">{settingsError}</p>}
              {settingsSaved && <p className="text-green-400 text-sm">✓ Gespeichert</p>}
              <Button loading={settingsSaving} onClick={saveSettings} className="w-full">Speichern</Button>
            </div>
          </Card>
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
      <Input placeholder="Urlaub 2022" value={title} onChange={e => setTitle(e.target.value)} className="flex-1" />
      <Button loading={loading} onClick={create} disabled={!title}>Anlegen</Button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { draft: 'bg-slate-700 text-slate-300', active: 'bg-green-900 text-green-300', finished: 'bg-slate-800 text-white/40' }
  const labels: Record<string, string> = { draft: 'Entwurf', active: 'Aktiv', finished: 'Beendet' }
  return <span className={`text-xs px-2 py-1 rounded-full ${map[status] ?? ''}`}>{labels[status] ?? status}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function LoadingScreen() {
  return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}
