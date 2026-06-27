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
            <p className="mb-4">
              Diese App ist eine private, geschlossene Anwendung, die ausschließlich für eine private
              Freundesgruppe betrieben wird. Es werden keine kommerziellen Zwecke verfolgt. Der Schutz deiner
              Daten ist uns wichtig – nachfolgend erklären wir, welche Daten wir verarbeiten und warum.
            </p>

            <Section title="1. Verantwortlicher">
              Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:<br />
              <b>[Paul Schleburg]</b><br />
              [Hofmeisterstr. 11, 93053 Regensburg]<br />
              E-Mail: <b>[wo.ist.paul49@gmail.com]</b>
            </Section>

            <Section title="2. Zweck & Rahmen">
              Die App dient ausschließlich dem Betrieb eines privaten Such-Spiels innerhalb einer geschlossenen
              Freundesgruppe (Anmeldung, Spielfortschritt, Ranglisten, Erfolge). Es findet <b>kein</b> Verkauf,
              <b> keine</b> Werbung und <b>keine</b> kommerzielle Nutzung statt.
            </Section>

            <Section title="3. Welche Daten wir verarbeiten">
              Bei der Registrierung: dein <b>Benutzername</b>, deine <b>E-Mail-Adresse</b> und dein Passwort
              (nur verschlüsselt/gehasht gespeichert, niemals im Klartext). Während des Spielens: deine
              Spielversuche, Punkte, Erfolge und deine Mitgliedschaft in Spielwelten. Eine IP- oder
              Standort-Erfassung zu Analysezwecken findet nicht statt.
            </Section>

            <Section title="4. E-Mail-Adresse">
              Deine E-Mail-Adresse wird <b>ausschließlich</b> zur Registrierung und zur möglichen
              Kontowiederherstellung gespeichert. Sie ist <b>kein</b> Login-Kriterium, für andere Spieler
              <b> nicht</b> sichtbar und wird nicht für Werbung oder Newsletter verwendet.
            </Section>

            <Section title="5. Rechtsgrundlage">
              Die Verarbeitung erfolgt auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du
              bei der Registrierung erteilst, sowie zur Erfüllung der Nutzung des Spiels (Art. 6 Abs. 1 lit. b
              DSGVO). Die Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.
            </Section>

            <Section title="6. Kein Tracking">
              Es werden <b>keine</b> Tracking-Cookies, kein Analyse-Werkzeug (z. B. Google Analytics) und keine
              Werbe-Netzwerke eingesetzt. Es findet kein Profiling und keine Weitergabe deiner Daten zu
              Werbezwecken statt.
            </Section>

            <Section title="7. Weitergabe & Hosting">
              Eine Weitergabe an Dritte zu kommerziellen Zwecken findet <b>nicht</b> statt. Zur technischen
              Bereitstellung werden Auftragsverarbeiter eingesetzt: <b>Supabase</b> (Datenbank, Authentifizierung,
              Speicher) und <b>Vercel</b> (Auslieferung der App). Diese verarbeiten Daten ausschließlich nach
              unserer Weisung. Innerhalb einer Spielwelt sind dein Benutzername und deine Spielstatistiken für
              die anderen Mitglieder dieser Gruppe sichtbar (z. B. in Ranglisten).
            </Section>

            <Section title="8. Speicherdauer">
              Deine Daten werden gespeichert, solange dein Konto besteht. Bei Löschung deines Kontos werden die
              zugehörigen Daten entfernt.
            </Section>

            <Section title="9. Deine Rechte">
              Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie
              auf Datenübertragbarkeit und Widerruf deiner Einwilligung. Zur Ausübung wende dich an den oben
              genannten Verantwortlichen unter <b>[wo.ist.paul49@gmail.com]</b>. Außerdem steht dir ein
              Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu.
            </Section>

            <Section title="10. Kontakt">
              Bei Fragen zum Datenschutz erreichst du uns unter <b>[wo.ist.paul49@gmail.com]</b>.
            </Section>

            <p className="text-xs text-slate-400 mt-4">Stand: [27.06.2026]</p>
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
