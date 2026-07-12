import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Server-synchronisierte Zeit (ms seit Epoch) für Freischalt-/Countdown-Logik.
// Die Basis kommt einmalig aus server_now() (autoritative UTC-Serverzeit); das Weiterticken
// nutzt performance.now() – eine MONOTONE Uhr, die von Änderungen der Geräte-Wanduhr NICHT
// beeinflusst wird. So kann ein Spieler durch Verstellen seiner Handy-Uhr kein Bild vorzeitig
// freischalten. Bis der Server antwortet, Fallback auf Date.now().
export function useServerNow(intervalMs = 1000): number {
  const baseRef = useRef<{ serverEpoch: number; perf: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    supabase.rpc('server_now').then(({ data, error }) => {
      if (!active || error || !data) return
      baseRef.current = { serverEpoch: new Date(data as string).getTime(), perf: performance.now() }
    })
    const id = setInterval(() => {
      const b = baseRef.current
      setNow(b ? Math.round(b.serverEpoch + (performance.now() - b.perf)) : Date.now())
    }, intervalMs)
    return () => { active = false; clearInterval(id) }
  }, [intervalMs])

  return now
}
