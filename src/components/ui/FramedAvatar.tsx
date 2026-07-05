import { AvatarFrame, type FrameType } from './AvatarFrame'
import { Avatar } from './Avatar'
import { isFrameId } from '../../lib/frames'

// Runder Avatar mit optionalem Cosmetic-Rahmen.
// - `size` = Foto-Durchmesser in px. Ist ein Rahmen gesetzt, ragt dessen Deko über
//   das Foto hinaus; das Layout bleibt aber size×size (Deko überlappt nur sichtbar).
// - `paused` schaltet die Animation ab (für lange Listen sinnvoll).
export function FramedAvatar({
  url, name, frame, size, paused = true, className = '',
}: {
  url?: string | null
  name?: string | null
  frame?: string | null
  size: number
  paused?: boolean
  className?: string
}) {
  if (isFrameId(frame)) {
    const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
    return (
      <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <AvatarFrame
            type={frame as FrameType}
            src={url ?? undefined}
            size={size}
            paused={paused}
            fallback={
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#8b5cf6', color: '#fff', fontWeight: 800, fontSize: 44 }}>
                {initial}
              </div>
            }
          />
        </div>
      </div>
    )
  }
  // Kein Rahmen -> normaler runder Avatar (Initial-Fallback inklusive).
  // Größe explizit per style, da die Aufrufer nur noch `size` (px) statt w-/h-Klassen liefern.
  return <Avatar url={url} name={name} className={`rounded-full ${className}`} style={{ width: size, height: size }} />
}
