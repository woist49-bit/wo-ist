import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '../components/ui/IconButton'
import { GameCard } from '../components/ui/GameCard'

export function DatenschutzPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col overflow-hidden">
      <div className="px-3 pt-2 pb-2 safe-top flex items-center gap-3 flex-shrink-0">
        <IconButton variant="grey" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={24} strokeWidth={2.5} /></IconButton>
        <h1 className="text-lg font-extrabold text-white">Datenschutzerklärung</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-none min-h-0 px-4 pb-8">
        <div className="max-w-lg mx-auto">
          <GameCard className="text-slate-700 text-sm leading-relaxed">
            <p className="text-xs text-slate-500 italic mb-4">
              Hinweis: Dies ist eine Vorlage. Bitte vor dem produktiven Einsatz rechtlich prüfen lassen.
            </p>

            <Section title="1. Verantwortlicher">
              Verantwortlich für die Datenverarbeitung in dieser App ist der Betreiber der Spielwelt.
              Kontakt erfolgt über die jeweilige Spielgruppe.
            </Section>

            <Section title="2. Welche Daten wir verarbeiten">
              Bei der Registrierung speichern wir deinen <b>Benutzernamen</b>, deine <b>E-Mail-Adresse</b> und
              dein (verschlüsselt gespeichertes) <b>Passwort</b>. Während des Spielens entstehen Daten zu
              deinen Versuchen, Punkten, Erfolgen und deiner Mitgliedschaft in Spielwelten.
            </Section>

            <Section title="3. Zweck der Verarbeitung">
              Die Daten dienen ausschließlich dem Betrieb des Spiels: Anmeldung, Spielfortschritt, Ranglisten
              und Erfolge. Die <b>E-Mail-Adresse</b> wird nur zur Registrierung und zur Kontowiederherstellung
              genutzt – sie ist <b>kein Login-Kriterium</b> und wird nicht für Werbung verwendet.
            </Section>

            <Section title="4. Weitergabe">
              Innerhalb einer Spielwelt sind dein Benutzername und deine Spielstatistiken für andere Mitglieder
              sichtbar (z. B. in Ranglisten). Deine E-Mail-Adresse ist für andere Spieler <b>nicht</b> sichtbar.
              Eine Weitergabe an Dritte zu Werbezwecken findet nicht statt.
            </Section>

            <Section title="5. Speicherung & Hosting">
              Die Daten werden bei unserem Infrastruktur-Dienstleister (Supabase) gespeichert. Die Auslieferung
              der App erfolgt über Vercel.
            </Section>

            <Section title="6. Deine Rechte">
              Du hast das Recht auf Auskunft, Berichtigung und Löschung deiner Daten. Du kannst dein Konto und
              die zugehörigen Daten jederzeit löschen lassen. Wende dich dazu an den Betreiber deiner Spielwelt.
            </Section>
          </GameCard>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-extrabold text-slate-800 mb-1">{title}</h2>
      <p>{children}</p>
    </div>
  )
}
