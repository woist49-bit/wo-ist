# Tutorial-Bilder

Hier gehören die vier Tutorial-Bilder hin:

- `tutorial_1.png` – UI kennenlernen (Ziel-Marker sichtbar, Person hinter dem Felsen)
- `tutorial_2.png` – Touch-Bedienung (Ziel-Marker sichtbar)
- `tutorial_3.png` – Marker selbst setzen (Ziel unsichtbar, Spieler tippt)
- `tutorial_4.png` – freies Suchen (Person klein zwischen den Felsen versteckt)

Die Bilder werden unter `/tutorial/tutorial_X.png` geladen (Vite serviert `public/` am Root).

## Marker-Koordinaten anpassen

Die festen Ziel-Marker liegen in `src/lib/tutorial.ts` in `TUTORIAL_IMAGES`:

```ts
target: { x_rel: 0.59, y_rel: 0.86, radius_rel: 0.171 }
```

- `x_rel`, `y_rel`: Position 0..1 der **natürlichen** Bildgröße (0/0 = oben links, 1/1 = unten rechts)
- `radius_rel`: Trefferradius als Bruchteil der **kürzeren Bildseite** (0..1) – exakt wie
  `target_radius` im restlichen Markierungs-System

Nach dem Einfügen der echten Bilder die Werte je Bild an die tatsächliche Position
der versteckten Person anpassen (v. a. für Bild 3 und 4 relevant, wo selbst gesucht wird).
