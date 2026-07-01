import { useState, useEffect } from 'react'

// Liefert die aktuelle Zeit und tickt im angegebenen Intervall, damit Countdowns
// im UI live weiterzählen. Das Intervall läuft nur, solange die Komponente gemountet ist.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
