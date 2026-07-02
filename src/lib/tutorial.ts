import { Calendar, Timer, BookOpen, Trophy, type LucideIcon } from 'lucide-react'

export const TUTORIAL_ACHIEVEMENT_KEY = 'tutorial_master'

export interface TutorialSlide {
  icon: LucideIcon
  title: string
  text: string
}

export const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    icon: Calendar,
    title: 'Live-Events',
    text: 'Regelmäßig werden neue Suchbilder freigeschaltet. Du hast eine begrenzte Zeit um den Charakter zu finden — danach verfällt das Bild.',
  },
  {
    icon: Timer,
    title: 'Je schneller desto besser',
    text: 'Sobald du ein Bild öffnest läuft die Zeit. Je schneller du den Charakter findest desto mehr Punkte bekommst du. Nach 2 Minuten bekommst du noch circa 100 Punkte.',
  },
  {
    icon: BookOpen,
    title: 'Kampagnen',
    text: 'Archivierte Events kannst du jederzeit in deinem eigenen Tempo spielen — Bild für Bild. Hier gibt es keinen Zeitdruck zwischen den Bildern.',
  },
  {
    icon: Trophy,
    title: 'Achievements und Level',
    text: 'Für besondere Leistungen schaltest du Achievements frei und sammelst XP. Steige im Level auf und zeige anderen wie erfahren du bist.',
  },
]

export interface TutorialImage {
  src: string
  hint: string
  // Fester Ziel-Marker: x_rel/y_rel sind 0..1 der natürlichen Bildgröße,
  // radius_px ist der Trefferradius in NATÜRLICHEN Bildpixeln (wie im echten Markierungs-System).
  target: { x_rel: number; y_rel: number; radius_px: number }
  // guided = Ziel-Ring von Anfang an sichtbar, Spieler tippt nur "Weiter".
  // Sonst: Spieler setzt selbst einen Marker und bestätigt, danach Auflösung.
  guided: boolean
}

// HINWEIS: x_rel / y_rel / radius_px an die echten Bilder anpassen, sobald sie in
// public/tutorial/ liegen. radius_px in natürlichen Pixeln des jeweiligen Bildes.
export const TUTORIAL_IMAGES: TutorialImage[] = [
  {
    src: '/tutorial/tutorial_1.png',
    guided: true,
    hint: 'Lerne die Benutzeroberfläche kennen — Zurück beendet den Versuch, der Timer startet beim Öffnen.',
    target: { x_rel: 0.5, y_rel: 0.5, radius_px: 70 },
  },
  {
    src: '/tutorial/tutorial_2.png',
    guided: true,
    hint: 'Ziehe mit einem Finger um das Bild zu verschieben. Zoome mit zwei Fingern oder dem Scrollrad.',
    target: { x_rel: 0.5, y_rel: 0.5, radius_px: 70 },
  },
  {
    src: '/tutorial/tutorial_3.png',
    guided: false,
    hint: 'Tippe auf die Person und bestätige deinen Tipp. Der Trefferradius passt sich der Größe der Person an.',
    target: { x_rel: 0.5, y_rel: 0.5, radius_px: 70 },
  },
  {
    src: '/tutorial/tutorial_4.png',
    guided: false,
    hint: 'Finde die Person auf eigene Faust — das ist das Ende des Tutorials!',
    target: { x_rel: 0.5, y_rel: 0.5, radius_px: 55 },
  },
]
