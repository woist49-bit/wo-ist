import { Outlet, useNavigate } from 'react-router-dom'
import { signOut } from '../../stores/auth'

export function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900/95 backdrop-blur border-b border-white/10 px-4 pb-3 safe-top flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white text-sm">← Zurück</button>
        <button onClick={() => navigate('/profile')} className="text-white/70 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/95 backdrop-blur border-t border-white/10 flex items-center justify-between px-4 pt-2 safe-bottom">
        <button onClick={() => navigate('/worlds')} className="text-white/70 hover:text-white flex flex-col items-center gap-1 text-xs">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Welten</span>
        </button>
        <button onClick={() => navigate('/leaderboard')} className="text-white/70 hover:text-white flex flex-col items-center gap-1 text-xs">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <span>Rangliste</span>
        </button>
      </footer>
    </div>
  )
}

export function WorldLayout() {
  const navigate = useNavigate()

  return (
    <div className="h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900/95 backdrop-blur border-b border-white/10 px-4 pb-3 safe-top flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white text-sm">← Zurück</button>
        <button onClick={() => navigate('profile')} className="text-white/70 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/95 backdrop-blur border-t border-white/10 flex items-center justify-between px-4 pt-2 safe-bottom">
        <button onClick={() => navigate('.')} className="text-white/70 hover:text-white flex flex-col items-center gap-1 text-xs">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Home</span>
        </button>
        <button onClick={() => navigate('leaderboard')} className="text-white/70 hover:text-white flex flex-col items-center gap-1 text-xs">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <span>Rangliste</span>
        </button>
      </footer>
    </div>
  )
}

export { signOut }
