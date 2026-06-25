// Erzeugt PWA-Platzhalter-Icons (Lupe auf Gradient) als PNG – ohne externe Abhängigkeiten.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = buf => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
const png = (S, rgba) => {
  const stride = S * 4
  const raw = Buffer.alloc((stride + 1) * S)
  for (let y = 0; y < S; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const lerp = (a, b, t) => a + (b - a) * t
const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const icon = S => {
  const rgba = Buffer.alloc(S * S * 4)
  const top = [49, 46, 129], bot = [15, 23, 42], white = [255, 255, 255]
  const cx = 0.43 * S, cy = 0.43 * S, R = 0.27 * S, ring = 0.075 * S
  const hAx = 0.595 * S, hAy = 0.595 * S, hBx = 0.8 * S, hBy = 0.8 * S, hW = 0.05 * S
  for (let y = 0; y < S; y++) {
    const ty = y / (S - 1)
    const bg = [Math.round(lerp(top[0], bot[0], ty)), Math.round(lerp(top[1], bot[1], ty)), Math.round(lerp(top[2], bot[2], ty))]
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      const dRing = Math.abs(Math.hypot(x - cx, y - cy) - R)
      const dHandle = distSeg(x, y, hAx, hAy, hBx, hBy)
      const cov = Math.max(
        Math.max(0, Math.min(1, ring - dRing + 0.5)),
        Math.max(0, Math.min(1, hW - dHandle + 0.5)),
      )
      rgba[i] = Math.round(lerp(bg[0], white[0], cov))
      rgba[i + 1] = Math.round(lerp(bg[1], white[1], cov))
      rgba[i + 2] = Math.round(lerp(bg[2], white[2], cov))
      rgba[i + 3] = 255
    }
  }
  return png(S, rgba)
}

mkdirSync('public', { recursive: true })
writeFileSync('public/pwa-512x512.png', icon(512))
writeFileSync('public/pwa-192x192.png', icon(192))
writeFileSync('public/apple-touch-icon.png', icon(180))
console.log('Icons erzeugt: pwa-512x512.png, pwa-192x192.png, apple-touch-icon.png')
