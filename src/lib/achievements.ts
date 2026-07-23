import type { Achievement } from '../types'

export const ACHIEVEMENTS: Achievement[] = [
  // Bronze
  { id: 'first_find', key: 'first_find', name: 'Erster Erfolg', description: 'Finde die gesuchte Person zum allerersten Mal.', tier: 'bronze', xp_reward: 100 },
  { id: 'first_event', key: 'first_event', name: 'Dabei sein ist alles', description: 'Nimm an deinem ersten Live-Event teil.', tier: 'bronze', xp_reward: 100, liveOnly: true },
  { id: 'legacy_first', key: 'legacy_first', name: 'Geschichtsunterricht', description: 'Schließe dein erstes Bild in einer alten Legacy-Kampagne ab.', tier: 'bronze', xp_reward: 150 },
  { id: 'near_miss', key: 'near_miss', name: 'Knapp vorbei ist auch daneben', description: 'Tippe daneben, liege aber weniger als 5% der Bildbreite vom Ziel entfernt.', tier: 'bronze', xp_reward: 100, liveOnly: true },
  // Global (nicht an eine Spielwelt gebunden) – wird über complete_tutorial vergeben, hier bei Bronze einsortiert
  { id: 'tutorial_master', key: 'tutorial_master', name: 'Tutorial-Absolvent', description: 'Schließe das Tutorial ab und lerne die Grundlagen des Spiels.', tier: 'bronze', xp_reward: 150, global: true },
  // Silver
  { id: 'eagle_eye', key: 'eagle_eye', name: 'Adlerauge', description: 'Finde die gesuchte Person in unter 5 Sekunden.', tier: 'silver', xp_reward: 500, liveOnly: true },
  { id: 'no_miss', key: 'no_miss', name: 'Urlaubs-Dauergast', description: 'Schließe ein komplettes Live-Event ab, ohne ein einziges Bild zu verpassen.', tier: 'silver', xp_reward: 500, liveOnly: true },
  { id: 'patient_finder', key: 'patient_finder', name: 'Ausdauer-Finder', description: 'Finde die gesuchte Person nach mehr als 5 Minuten intensiver Suche (ohne Fehlversuch).', tier: 'silver', xp_reward: 400, liveOnly: true },
  { id: 'streak_5', key: 'streak_5', name: 'Serientäter', description: 'Treffe bei 5 Bildern in Folge direkt beim ersten Versuch ins Schwarze.', tier: 'silver', xp_reward: 600, liveOnly: true },
  // Gold
  { id: 'first_win', key: 'first_win', name: 'Der Champion', description: 'Hol dir deinen allerersten Gesamtsieg in einem Live-Event.', tier: 'gold', xp_reward: 1500, liveOnly: true },
  { id: 'perfect_event', key: 'perfect_event', name: 'Perfekter Urlaub', description: 'Schließe ein komplettes 10-Tages-Event ab und finde die gesuchte Person an jedem Tag richtig.', tier: 'gold', xp_reward: 2500, liveOnly: true },
  { id: 'campaign_king', key: 'campaign_king', name: 'Kampagnen-König', description: 'Schließe alle Bilder einer kompletten Kampagne erfolgreich ab.', tier: 'gold', xp_reward: 1200 },
  { id: 'last_minute', key: 'last_minute', name: 'Nerven aus Stahl', description: 'Finde die gesuchte Person in der letzten Stunde, bevor das aktuelle Bild verfällt.', tier: 'gold', xp_reward: 1000, liveOnly: true },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.key, a]))

export const TIER_COLORS = {
  bronze: 'text-amber-700',
  silver: 'text-slate-400',
  gold: 'text-yellow-400',
}

export const TIER_BG = {
  bronze: 'bg-amber-900/30 border-amber-700/50',
  silver: 'bg-slate-700/30 border-slate-400/50',
  gold: 'bg-yellow-900/30 border-yellow-500/50',
}
