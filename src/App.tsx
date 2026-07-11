import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout, WorldLayout } from './components/layout/AppLayout'
import { ToastProvider } from './stores/toast'
import { NotificationProvider } from './stores/notifications'
import { ToastContainer } from './components/ui/ToastContainer'
import { ThemeColorManager } from './components/ThemeColorManager'
import { AuthPage } from './pages/AuthPage'
import { DatenschutzPage } from './pages/DatenschutzPage'
import { TutorialPage } from './pages/TutorialPage'
import { ShopPage } from './pages/ShopPage'
import { WorldsPage } from './pages/WorldsPage'
import { WorldHomePage } from './pages/WorldHomePage'
import { EventPage } from './pages/EventPage'
import { CampaignPage } from './pages/CampaignPage'
// Globus-Seite (three.js) lazy laden – hält das App-Start-Bundle klein.
const CampaignGlobePage = lazy(() => import('./pages/CampaignGlobePage').then(m => ({ default: m.CampaignGlobePage })))
import { ImageGamePage } from './pages/ImageGamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { AchievementsPage } from './pages/AchievementsPage'
import { ProfilePage } from './pages/ProfilePage'
// Admin-Verwaltung lazy laden – hält Leaflet (Standortwähler) aus dem Start-Bundle.
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then(m => ({ default: m.AdminPage })))
import { AdminEventPage } from './pages/admin/AdminEventPage'
import { AdminImagePage } from './pages/admin/AdminImagePage'
import { AdminCampaignPage } from './pages/admin/AdminCampaignPage'

function LazyFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-white/70 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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
      <NotificationProvider>
      <BrowserRouter>
      <ThemeColorManager />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/worlds" replace /> : <AuthPage />} />
        <Route path="/datenschutz" element={<DatenschutzPage />} />
        <Route path="/tutorial" element={user ? <TutorialPage /> : <Navigate to="/" replace />} />
        <Route path="/shop" element={user ? <ShopPage /> : <Navigate to="/" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/worlds" element={user ? <WorldsPage /> : <Navigate to="/" replace />} />
          <Route path="/leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
          <Route path="/profile/:userId" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="/world/:worldId" element={<WorldLayout />}>
          <Route index element={user ? <WorldHomePage /> : <Navigate to="/" replace />} />
          <Route path="leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/" replace />} />
          <Route path="achievements" element={user ? <AchievementsPage /> : <Navigate to="/" replace />} />
          <Route path="profile" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
          <Route path="profile/:userId" element={user ? <ProfilePage /> : <Navigate to="/" replace />} />
          <Route path="event/:eventId" element={user ? <EventPage /> : <Navigate to="/" replace />} />
          <Route path="event/:eventId/image/:imageId" element={user ? <ImageGamePage /> : <Navigate to="/" replace />} />
          <Route path="campaigns" element={user ? <Suspense fallback={<LazyFallback />}><CampaignGlobePage /></Suspense> : <Navigate to="/" replace />} />
          <Route path="campaign/:campaignId" element={user ? <CampaignPage /> : <Navigate to="/" replace />} />
          <Route path="campaign/:campaignId/image/:imageId" element={user ? <ImageGamePage /> : <Navigate to="/" replace />} />
          <Route path="admin" element={user ? <Suspense fallback={<LazyFallback />}><AdminPage /></Suspense> : <Navigate to="/" replace />} />
          <Route path="admin/event/:eventId" element={user ? <AdminEventPage /> : <Navigate to="/" replace />} />
          <Route path="admin/event/:eventId/image/:imageId" element={user ? <AdminImagePage /> : <Navigate to="/" replace />} />
          <Route path="admin/campaign/:campaignId" element={user ? <AdminCampaignPage /> : <Navigate to="/" replace />} />
          <Route path="admin/campaign/:campaignId/image/:imageId" element={user ? <AdminImagePage /> : <Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
      </NotificationProvider>
    </ToastProvider>
  )
}
