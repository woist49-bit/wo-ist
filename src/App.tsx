import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout, WorldLayout } from './components/layout/AppLayout'
import { ToastProvider } from './stores/toast'
import { ToastContainer } from './components/ui/ToastContainer'
import { AuthPage } from './pages/AuthPage'
import { WorldsPage } from './pages/WorldsPage'
import { WorldHomePage } from './pages/WorldHomePage'
import { EventPage } from './pages/EventPage'
import { CampaignPage } from './pages/CampaignPage'
import { ImageGamePage } from './pages/ImageGamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { AchievementsPage } from './pages/AchievementsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/admin/AdminPage'
import { AdminEventPage } from './pages/admin/AdminEventPage'
import { AdminCampaignPage } from './pages/admin/AdminCampaignPage'

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/worlds" replace /> : <AuthPage />} />
        <Route element={<AppLayout />}>
          <Route path="/worlds" element={user ? <WorldsPage /> : <Navigate to="/" replace />} />
          <Route path="/leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="/world/:worldId" element={<WorldLayout />}>
          <Route index element={user ? <WorldHomePage /> : <Navigate to="/" replace />} />
          <Route path="leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/" replace />} />
          <Route path="achievements" element={user ? <AchievementsPage /> : <Navigate to="/" replace />} />
          <Route path="profile" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
          <Route path="event/:eventId" element={user ? <EventPage /> : <Navigate to="/" replace />} />
          <Route path="event/:eventId/image/:imageId" element={user ? <ImageGamePage /> : <Navigate to="/" replace />} />
          <Route path="campaign/:campaignId" element={user ? <CampaignPage /> : <Navigate to="/" replace />} />
          <Route path="campaign/:campaignId/image/:imageId" element={user ? <ImageGamePage /> : <Navigate to="/" replace />} />
          <Route path="admin" element={user ? <AdminPage /> : <Navigate to="/" replace />} />
          <Route path="admin/event/:eventId" element={user ? <AdminEventPage /> : <Navigate to="/" replace />} />
          <Route path="admin/campaign/:campaignId" element={user ? <AdminCampaignPage /> : <Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
    </ToastProvider>
  )
}
