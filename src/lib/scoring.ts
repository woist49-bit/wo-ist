export function calcPoints(seconds: number): number {
  return Math.max(Math.round(300 * Math.exp(-0.009 * seconds)), 10)
}

// Verzerrte (effektive) Spielzeit aus der echten Zeit – für Timer-Debuff & Zeitlupe.
// - Timer-Debuff: läuft 2x schnell für je 10s pro Stapel (nacheinander, also 0..10*stacks).
// - Zeitlupe: läuft 0.5x schnell für die ersten 10s.
// - Überlappen sich Zeitlupe und Timer-Debuff, heben sie sich auf (1x).
// Mehr effektive Zeit = weniger Punkte, weniger effektive Zeit = mehr Punkte.
export function effectiveElapsed(realSeconds: number, timerStacks: number, zeitlupe: boolean): number {
  if (realSeconds <= 0) return 0
  const dEnd = 10 * Math.max(0, timerStacks)   // Ende des Timer-Debuff-Fensters
  const zEnd = zeitlupe ? 10 : 0               // Ende des Zeitlupe-Fensters
  const rateAt = (t: number) => {
    const d = t < dEnd
    const z = t < zEnd
    if (d && z) return 1      // heben sich auf
    if (d) return 2           // doppelt so schnell
    if (z) return 0.5         // halb so schnell
    return 1
  }
  // Raten sind zwischen den Grenzen konstant -> stückweise integrieren
  const bounds = Array.from(new Set([0, zEnd, dEnd, realSeconds].filter(b => b >= 0 && b <= realSeconds))).sort((a, b) => a - b)
  let eff = 0
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1]
    eff += (b - a) * rateAt((a + b) / 2)
  }
  return eff
}

export function xpForNextLevel(currentLevel: number): number {
  return Math.round(300 * Math.pow(currentLevel, 1.2))
}

export function totalXpForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) {
    total += xpForNextLevel(i)
  }
  return total
}

export function levelFromXp(totalXp: number): { level: number; xpIntoLevel: number; xpNeeded: number } {
  let level = 1
  let remaining = totalXp
  while (true) {
    const needed = xpForNextLevel(level)
    if (remaining < needed) {
      return { level, xpIntoLevel: remaining, xpNeeded: needed }
    }
    remaining -= needed
    level++
  }
}

export function isHit(
  clickX: number,
  clickY: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
  imageWidth: number,
  imageHeight: number,
): boolean {
  const dx = (clickX - targetX) * imageWidth
  const dy = (clickY - targetY) * imageHeight
  const radiusPx = targetRadius * Math.min(imageWidth, imageHeight)
  return Math.sqrt(dx * dx + dy * dy) <= radiusPx
}

export function distanceFraction(
  clickX: number,
  clickY: number,
  targetX: number,
  targetY: number,
): number {
  return Math.sqrt(Math.pow(clickX - targetX, 2) + Math.pow(clickY - targetY, 2))
}
