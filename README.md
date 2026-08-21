# Schnipsel

Collagen für Instagram-Storys, ohne Instagrams Layout-Werkzeug.

Bilder auswählen, die App schlägt ein Layout vor, das zu den Seitenverhältnissen
passt, alles bleibt danach anfassbar, und ein Tipp schiebt das fertige Bild in
den Story-Composer.

## Loslegen

```bash
bun install
bunx eas build --profile development --platform android   # einmalig: Dev-Client-APK
bun start                                                  # Metro
```

Die APK aufs Android-Gerät ziehen, installieren, App öffnen, Metro-URL scannen.
Danach reicht `bun start` für jede weitere Änderung.

Für eine eigenständige APK ohne Metro: `bunx eas build --profile preview --platform android`.

```bash
bun test        # Geometrie und Layout-Generator
bun typecheck
```

## Wie es aufgebaut ist

| Datei | Aufgabe |
| --- | --- |
| `src/model/collage.ts` | Dokumentmodell. Positionen relativ, nie in Pixeln. |
| `src/model/geometry.ts` | Rechnet relativ → Pixel. Preview und Export gehen beide hier durch. |
| `src/model/layout.ts` | Layout-Rezepte und die Suche nach dem, das am wenigsten beschneidet. |
| `src/render/CollageScene.tsx` | Die Skia-Szene. Editor und Export rendern dasselbe Element. |
| `src/render/export.ts` | 1080×1920 offscreen, JPEG q90. |
| `src/share/instagram.ts` | `ADD_TO_STORY`-Intent. |
| `src/editor/useEditor.ts` | Collage, Undo, Autosave. |

Zwei Entscheidungen tragen den Rest:

**Positionen sind relativ.** Ein Layer speichert `{x, y, w, h}` als Anteil der
Inhaltsfläche. Dieselbe Collage rendert deshalb ohne Umbau nach 9:16 für die
Story und nach 4:5 für einen Feed-Post.

**Ein Raster ist kein Modus, sondern ein Generator.** Layer haben immer einen
freien Rahmen; „3er-Raster" rechnet nur Rahmenwerte aus. Ein sauberes Layout
lässt sich danach schiefziehen, ohne das Raster zu verlassen.

## Nicht drin, mit Absicht

Kein Text, keine Filter, keine Sticker. Instagram kann das besser, und sie kennt
die Bedienung dort. Schnipsel baut das Layout, Instagram macht den Rest.
