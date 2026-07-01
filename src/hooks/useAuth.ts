// Re-Export, damit bestehende Importe (../hooks/useAuth) unverändert weiterlaufen.
// Der eigentliche Auth-Zustand lebt jetzt zentral im AuthProvider (stores/authStore).
export { useAuth } from '../stores/authStore'
