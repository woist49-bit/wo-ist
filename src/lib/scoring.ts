export function calcPoints(seconds: number): number {
  return Math.max(Math.round(300 * Math.exp(-0.009 * seconds)), 10)
}

export function xpForNextLevel(currentLevel: number): number {
  return Math.round(500 * Math.pow(currentLevel, 1.3))
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
