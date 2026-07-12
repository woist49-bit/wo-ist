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

// Offset von Europe/Berlin gegenüber UTC (ms) zum gegebenen Zeitpunkt – DST-korrekt via Intl.
function berlinOffsetMs(epochMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(epochMs))
  const p: Record<string, number> = {}
  for (const part of parts) if (part.type !== 'literal') p[part.type] = Number(part.value)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - epochMs
}

// Wandelt eine WANDUHRZEIT in Europe/Berlin (Datum "YYYY-MM-DD" + Stunde/Minute) in einen
// UTC-ISO-String um. So ist die gespeicherte Zeit unabhängig von der Geräte-Zeitzone des Admins:
// alle Spieler bekommen dasselbe absolute UTC-Freischaltinstant. DST-Randfälle über zwei Iterationen.
export function berlinWallTimeToUtcISO(dateYmd: string, hour: number, minute: number): string {
  const [y, mo, d] = dateYmd.split('-').map(Number)
  const asIfUtc = Date.UTC(y, mo - 1, d, hour, minute, 0)
  let utc = asIfUtc - berlinOffsetMs(asIfUtc)
  utc = asIfUtc - berlinOffsetMs(utc)
  return new Date(utc).toISOString()
}

// Kalenderdatum "YYYY-MM-DD" eines Zeitpunkts in Europe/Berlin (für die Tages-Slot-Berechnung).
export function berlinDateYmd(epochMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(epochMs))
}

// "heute" / "morgen" / "am 03.07." – relativ zum aktuellen Kalendertag.
export function relativeDay(target: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000)
  if (diffDays === 0) return 'heute'
  if (diffDays === 1) return 'morgen'
  return `am ${target.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
}
