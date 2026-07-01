// Zeigt das Profilbild oder – wenn keins gesetzt ist – den Anfangsbuchstaben als Fallback.
// Größe, Rundung, Schatten und Textgröße kommen per className/textClassName vom Aufrufer,
// damit derselbe Avatar in Header, Rangliste, Mitgliederliste und Profil passt.
export function Avatar({
  url,
  name,
  className = '',
  textClassName = '',
}: {
  url?: string | null
  name?: string | null
  className?: string
  textClassName?: string
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
  return (
    <div className={`relative overflow-hidden bg-violet-500 text-white font-extrabold flex items-center justify-center flex-shrink-0 ${className}`}>
      {url
        ? <img src={url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        : <span className={textClassName}>{initial}</span>}
    </div>
  )
}
