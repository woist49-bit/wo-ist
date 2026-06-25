import type { HTMLAttributes } from 'react'

// Game-UI-Card: warm-beiger Innenbereich, dicker Rand, stark abgerundet, dezente Tiefe.
// Standard ist cremeweiß mit Tan-Rand; für farbige Banner border/bg per className überschreiben.
export function GameCard({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`bg-[#fdf6e3] border-[3px] border-[#e6d3a3] rounded-[1.75rem] p-4 text-slate-800 shadow-[0_5px_0_#0000001f] ${className}`}
    >
      {children}
    </div>
  )
}
