# Pixelplein stijlpakket voor apps en tools

Dezelfde stijl als de website (richting B), klaar om in het keuzebord en andere tools te gebruiken.
Werkt in elke webapp: gewone HTML, React, Vue of Svelte. Er is niets te installeren.

Open `voorbeeld.html` in je browser om alles te zien.

## Wat zit erin

| Map / bestand | Wat |
|---|---|
| `css/tokens.css` | Alle kleuren, lettertypes, maten, afrondingen en bewegingstijden als CSS-variabelen (`--pp-…`) |
| `css/fonts.css` | Lettertypes, zelf gehost (geen Google Fonts, dus privacyvriendelijk) |
| `css/pixelplein-app.css` | Onderdelen: knoppen, icoonknop, tegels, kaarten, invoervelden, schakelaar, chips, labels, koppen |
| `js/pixelplein-app.js` | Lettergolf in knoppen (optioneel, 1 KB) |
| `fonts/` | Fraunces, Figtree en Bricolage Grotesque + licenties (SIL OFL: commercieel gebruik toegestaan) |
| `logo/` | p'tje en pixelwoord als SVG (licht en donker), app-iconen als PNG |
| `tokens.json` | Dezelfde waarden als data, voor Figma (Tokens Studio), Tailwind of een native app |
| `voorbeeld.html` | Voorbeeldscherm met alle onderdelen |

## Toepassen in 3 stappen

1. Kopieer de mappen `css`, `js`, `fonts` en `logo` naar de `public`- of `static`-map van je app.
2. Zet in je `index.html`, in deze volgorde:

   ```html
   <link rel="stylesheet" href="/css/fonts.css">
   <link rel="stylesheet" href="/css/tokens.css">
   <link rel="stylesheet" href="/css/pixelplein-app.css">
   <script src="/js/pixelplein-app.js" defer></script>
   ```

3. Vervang in je eigen CSS de vaste kleuren door de variabelen, bijvoorbeeld `#1e3a8a` door `var(--pp-color-ink)`. Zet `class="pp"` op `<body>` voor achtergrond, tekst en lettertype.

Daarna kun je per scherm de onderdelen gebruiken (`pp-btn`, `pp-tile`, `pp-card`, …). Kijk in `voorbeeld.html` voor de HTML.

## Kleuren en hun taak

| Kleur | Variabele | Hex | Taak |
|---|---|---|---|
| Ice Blue | `--pp-color-ice` | `#D8EAFB` | Achtergrond van elk scherm |
| Dark Blue | `--pp-color-ink` | `#0E2A56` | Tekst, kopbalk, grote donkere vlakken |
| Butter Yellow | `--pp-color-butter` | `#FBE8B5` | Gekozen, aan de beurt, badge; koppen op Dark Blue |
| Cool Red | `--pp-color-red` | `#B5182B` | Hoofdknop (één per scherm), een enkel accentwoord |
| Rood ingedrukt | `--pp-color-red-press` | `#94121F` | Hover en indrukken van de rode knop |
| Wit | `--pp-color-white` | `#FFFFFF` | Kaarten, tegels, invoervelden |
| Zacht ijs | `--pp-color-ice-soft` | `#EAF3FD` | Hover, kleine vlakken |
| Zachte boter | `--pp-color-butter-soft` | `#FDF4DC` | Uitgelichte kaart |
| Papier | `--pp-color-paper` | `#FFFBF2` | Menubalk |
| Gedimd blauw | `--pp-color-ink-muted` | `#4A5D80` | Lopende en kleine tekst (contrast 5,4:1) |
| Toonverschil | `--pp-color-ink-dim` | `#6E7C99` | Gedimd deel van grote koppen |
| Toonverschil op donker | `--pp-color-on-ink-dim` | `#8FA3C7` | Gedimde tekst op Dark Blue |

## Vuistregels voor een app

- **Achtergrond Ice Blue, tekst Dark Blue.** Kaarten en tegels zijn wit.
- **Rood is de klik.** Maximaal één rode hoofdknop per scherm. Rood nooit als tekst op Dark Blue (te weinig contrast).
- **Botergeel betekent "gekozen" of "warm".** Een gekozen hoek, het plaatje van het kind dat aan de beurt is, een badge.
- **Dark Blue voor grote vlakken**, zoals het bord zelf of de kopbalk. Daarop zijn koppen en accenten botergeel.
- **Letters:** Figtree voor alles wat kinderen en leerkrachten lezen en aantikken. Fraunces alleen voor koppen. Bricolage alleen voor één grote kop (zoals een welkomstscherm).
- **Groot voor kleuters:** gebruik `pp-btn--lg` en `pp-tile` op het digibord, minimaal 64 px hoog.
- **Beweging:** kort en zacht (150–300 ms). Bij "minder beweging" staat alles stil; dat zit er al in.

## In React of Vue

De CSS werkt meteen. De lettergolf splitst knopteksten in letters. Roep na het tekenen van nieuwe knoppen `window.Pixelplein.wave()` aan. Wil je dat niet, laat het script dan weg: de knoppen werken ook zonder.

## Tailwind

Gebruik je Tailwind, zet dan in de config (v3):

```js
theme: { extend: { colors: {
  ink: "var(--pp-color-ink)", ice: "var(--pp-color-ice)",
  butter: "var(--pp-color-butter)", red: { DEFAULT: "var(--pp-color-red)", press: "var(--pp-color-red-press)" },
}, fontFamily: { display: "var(--pp-font-display)", body: "var(--pp-font-body)" } } }
```

## Bijwerken

Dit pakket wordt gemaakt met `python3 tools/build-app-kit.py` in het website-project, uit dezelfde bron als de website (`assets/css/tokens.css`). Pas daar iets aan, en zowel de site als dit pakket veranderen mee. Pas de bestanden hier dus niet met de hand aan.
