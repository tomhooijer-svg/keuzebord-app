# Keuzebord – details

## Doel
Digitaal keuzebord voor kleutergroepen: kinderen verplaatsen hun picto naar een hoek/activiteit op het digibord.
Eerst gratis testomgeving voor testscholen (feedbackknoppen, beknopte handleiding, eenvoudige inloggegevens). Cloud-based, werkt op meerdere apparaten.

## Functies
Al gebouwd (stand 28-10-2026):
- Bord met picto's/foto's, hoeken per thema, tijdsvergrendeling (juf kan overrulen), werkt offline door (local-first)
- Beheer per leerkracht, schoolbeheer, platformbeheer (accounts/scholen over alle scholen, feedbackoverzicht)
- Inloggen met gebruikersnaam (geen e-mail), wachtwoord-kaartje om te printen, wachtwoord reset door beheerder
- Meekijken/bedienen door leerkracht, statistieken (waar, hoe lang, met wie), verslag per kind (docx/PDF)
- Thema-vormgeving, 44 getekende picto's, demo zonder account, rondleiding, handleiding, privacyverklaring, feedbackknop
- Kindfoto's staan standaard uit (schoolbeheerder zet ze aan)

Gepland / open:
- Planbord vervalt voorlopig (weekplan/taken/doelen zitten nog wel in schema en beheer)

## Techniek
- Stack: vanilla JS + HTML/CSS, geen bouwstap, geen pakketten. PWA (`manifest.json`). Supabase (auth, Postgres met RLS, opslag-bucket `kb-media`). Stijl uit `stijl/` (Pixelplein-stijlpakket, `--pp-…`-tokens, zelf gehoste fonts).
- Bestanden:
  - Schermen: `bord.html` (digibord), `beheer.html` (leerkracht), `school.html` (schoolbeheer), `platform.html` (platformbeheer), `inloggen.html`, `demo.html`, `handleiding.html`, `privacy.html`, `pictos.html` (printen), `testbord.html` (multitouch-test), `diagnose.html` (wat staat er op dit apparaat), `index.html` (landing)
  - `src/kb-verbinding.js` start elk scherm; `kb-data.js` lokale gegevens; `kb-sync.js` sync met server; `kb-supabase.js` verbinding (project-URL + publieke sleutel); `kb-media.js` foto's
  - `src/kb-bord.js`, `kb-beheer.js`, `kb-school.js`, `kb-platform.js` per scherm; `kb-statistiek*.js`, `kb-docx.js` (verslag), `kb-pictobank.js`, `kb-demo.js`, `kb-rondleiding.js`, `kb-feedback.js`, `kb-testbanner.js` (testversie-chip, `KB.VERSIE`)
  - `supabase/schema.sql` (alles, herhaalbaar te draaien), `supabase/inrichten.sql`, `supabase/test-0*.sql` (RLS-proeven op gewone Postgres)
  - `data/doelen-gouwe-academie.json` (doelenlijst)
- Supabase-tabellen (project `zlmunykkhooscnxbfvvg`):
  - School/accounts: `scholen`, `profielen`, `uitnodigingen`, `groepen`, `groep_leden`, `groep_verzoeken`, `ondersteuning`, `handelingen` (logboek), `feedback`
  - Bord: `leerlingen`, `media`, `hoeken`, `themas`, `thema_hoeken`, `borden`, `bord_hoeken`, `plaatsingen`, `wachtrij`, `gebeurtenissen`
  - Planwerk: `doelen`, `groep_doelen`, `thema_doelen`, `taken`, `taak_doelen`, `weekplannen`, `week_doelen`, `weekplan_taken`, `taak_toewijzing`, `observaties`
  - Rechten via functies o.a. `mijn_school()`, `mag_bij_groep()`, `ben_schoolbeheerder()`, `ben_platformbeheerder()`; gebruikersnaam-login via `inlogadres()`
- Hosting: GitHub Pages (tomhooijer-svg/keuzebord-app). `_headers`, `.nojekyll`, `404.html` aanwezig.
- Lokaal testen:
  - `python3 -m http.server 8000 --bind 127.0.0.1` in deze map, open http://127.0.0.1:8000/demo.html (geen account, alles in de browser)
  - Echte schermen (`bord.html`, `beheer.html`) praten met de live Supabase: inloggen met een testaccount, geen echte kinderdata gebruiken
  - Op het digibord: na deploy openen en `diagnose.html` gebruiken om te zien welke versie er draait
  - Let op: README noemt een map `test/` (nep-Supabase + browserproeven) en `kb-verslag.js`; die staan niet in deze repo

## Regels
- Touch-first: grote raakvlakken, geen hover-afhankelijkheid, werkt op Prowise-digibord.
- Een 4-jarige moet het zonder lezen kunnen bedienen.
- Rechten horen in de database (RLS in `schema.sql`), niet alleen in de app. Wijzig je een tabel → `privacy-avg` laten meekijken.
- Geen namen, foto's of back-ups van kinderen in de repo (zie `.gitignore`).
