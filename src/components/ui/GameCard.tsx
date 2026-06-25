import type { HTMLAttributes } from 'react'

// Game-UI-Card: heller Innenbereich, dicker Rand, abgerundet, dezente Tiefe.
// Standard ist neutral (cremeweiß); für farbige Banner border/bg per className überschreiben.
export function GameCard({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`bg-[#fdf8ec] border-[3px] border-black/10 rounded-3xl p-4 text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.18)] ${className}`}
    >
      {children}
    </div>
  )
}
