# Journey film (Startseite, Abschnitt „Ablauf“)

Die Scroll-Sequenz auf der Startseite ist ein vorgerenderter Film:
Lager → Tor öffnet → 40-t-Sattelzug fährt ab → Autobahn → Ankunft am Hub.
Szene, Fahrzeug und Umgebung werden vollständig per Python in Blender
aufgebaut (keine fremden 3D-Modelle oder Texturen). Das JARBOU-Logo wird
aus `public/brand/*.svg` gerastert (`logo.png`, `logo-white.png`).

## Voraussetzungen

```sh
python3 -m venv /opt/bl
/opt/bl/bin/pip install bpy==5.0.1 numpy pillow    # Blender als Python-Modul
```

## Ablauf

```sh
# 1. Rendern (Desktop 1440×810 und Mobil 720×1280, je 120 Bilder)
SAMPLES=24 OUT=/tmp/journey ./run_all.sh      # abbrechbar, setzt mit --skip-existing fort

# 2. Fotografische Nachbearbeitung (Bloom, Vignette, Farbe; Korn kommt per CSS)
/opt/bl/bin/python post.py /tmp/journey/raw/desktop /tmp/journey/post/desktop --no-grain
/opt/bl/bin/python post.py /tmp/journey/raw/mobile  /tmp/journey/post/mobile  --no-grain

# 3. Web-Formate (AVIF + WebP)
node encode.mjs /tmp/journey/post/desktop ../../public/journey/d
node encode.mjs /tmp/journey/post/mobile  ../../public/journey/m
```

Einzelbilder zur Abstimmung: `stills.py --out /tmp/stills` (vier Motive).

## Dateien

| Datei | Inhalt |
| --- | --- |
| `truck.py` | Sattelzug: Fahrerhaus (mit Innenraum), Auflieger, Räder, Lichter, Beschriftung |
| `world.py` | Halle, Hof, Autobahn, Hub, Landschaft, Verkehr |
| `scene.py` | Zeitablauf (150 Design-Frames), Kamerafahrten Desktop/Mobil, Licht |
| `render.py` | Rendert Bilder; `--count 120` verteilt die Ausgabe gleichmäßig |
| `post.py`, `encode.mjs` | Nachbearbeitung und Kodierung |

Die Website liest Anzahl und Größen aus `src/sections/home/journey/frames.ts`.
