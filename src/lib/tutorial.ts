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
  // radius_rel ist der Trefferradius als Bruchteil der KÜRZEREN Bildseite
  // (0..1) – exakt wie target_radius im restlichen Markierungs-System.
  target: { x_rel: number; y_rel: number; radius_rel: number }
  // guided = Ziel-Ring von Anfang an sichtbar, Spieler tippt nur "Weiter".
  // Sonst: Spieler setzt selbst einen Marker und bestätigt, danach Auflösung.
  guided: boolean
}

export const TUTORIAL_IMAGES: TutorialImage[] = [
  {
    src: '/tutorial/tutorial_1.png',
    guided: true,
    hint: 'Lerne die Benutzeroberfläche kennen — Zurück beendet den Versuch, der Timer startet beim Öffnen.',
    target: { x_rel: 0.59, y_rel: 0.86, radius_rel: 0.171 },
  },
  {
    src: '/tutorial/tutorial_2.png',
    guided: true,
    hint: 'Ziehe mit einem Finger um das Bild zu verschieben. Zoome mit zwei Fingern oder dem Scrollrad.',
    target: { x_rel: 0.64, y_rel: 0.61, radius_rel: 0.198 },
  },
  {
    src: '/tutorial/tutorial_3.png',
    guided: false,
    hint: 'Tippe auf die Person und bestätige deinen Tipp. Der Trefferradius passt sich der Größe der Person an.',
    target: { x_rel: 0.17, y_rel: 0.48, radius_rel: 0.038 },
  },
  {
    src: '/tutorial/tutorial_4.png',
    guided: false,
    hint: 'Finde die Person auf eigene Faust — das ist das Ende des Tutorials!',
    target: { x_rel: 0.28, y_rel: 0.85, radius_rel: 0.027 },
  },
]
