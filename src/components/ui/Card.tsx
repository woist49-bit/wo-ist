import type { HTMLAttributes } from 'react'

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`bg-white/5 border border-white/10 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  )
}
