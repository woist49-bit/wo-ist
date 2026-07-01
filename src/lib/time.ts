// Ein Live-Event-Bild ist ab Freischaltung 24 Stunden spielbar.
export const IMAGE_PLAY_WINDOW_MS = 24 * 60 * 60 * 1000

// Formatiert eine Restdauer (ms) als deutschen Countdown, z. B. "5 Std 12 Min".
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0 Sek'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d} ${d === 1 ? 'Tag' : 'Tage'} ${h} Std`
  if (h > 0) return `${h} Std ${m} Min`
  if (m > 0) return `${m} Min ${s} Sek`
  return `${s} Sek`
}

// "09:05" aus Stunde/Minute.
export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// "heute" / "morgen" / "am 03.07." – relativ zum aktuellen Kalendertag.
export function relativeDay(target: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000)
  if (diffDays === 0) return 'heute'
  if (diffDays === 1) return 'morgen'
  return `am ${target.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
}
