# Keuzebord

Een digitaal keuzebord voor kleutergroepen. Kinderen kiezen zelf een hoek
op het digibord; de leerkracht plant er haar week omheen.

Draait zonder bouwstap: het zijn gewone HTML-bestanden met een paar
scripts ernaast. De gegevens staan in Supabase, achter een login.

## De schermen

| bestand | waarvoor |
|---|---|
| `bord.html` | het keuzebord op het digibord, waar de kinderen kiezen |
| `beheer.html` | de omgeving van één leerkracht: haar groep, taken, weekplan |
| `school.html` | het schoolbeheer: alle groepen, wie waar bij mag |
| `inloggen.html` | inloggen en accounts |
| `testbord.html` | los testbord om te kijken hoeveel vingers tegelijk werken |

## Zelf opzetten

1. Maak een project op [supabase.com](https://supabase.com).
2. Plak `supabase/schema.sql` in de SQL Editor en druk op Run. Dat maakt
   alle tabellen, de rechten per groep en de plek voor de foto's.
3. Zet je eigen adres en publieke sleutel bovenin `src/kb-supabase.js`.
4. Maak twee accounts aan onder Authentication → Users, en vul hun
   e-mailadressen in bij `supabase/inrichten.sql`. Run dat ook.
5. Zet de bestanden ergens neer die statische bestanden serveert —
   GitHub Pages voldoet.

Vergeet niet in Supabase onder **Authentication → URL Configuration** het
adres van je site in te vullen, anders weigert het inloggen.

## Hoe het in elkaar zit

- `src/kb-data.js` — de gegevens van een groep, in de browser
- `src/kb-supabase.js` — de verbinding met de server
- `src/kb-sync.js` — heen en weer: wat verschilt met de vorige keer gaat mee
- `src/kb-media.js` — de foto's, naar de opslag en terug
- `src/kb-verbinding.js` — de lijm: elk scherm begint hiermee
- `src/kb-statistiek.js` — wie kiest wat, en wie speelt met wie
- `src/kb-verslag.js` — een blad per kind voor het oudergesprek, af te
  drukken of te bewaren als PDF

Het bord blijft werken als de verbinding wegvalt. Een klas wacht niet.

## Zelf nakijken

In `test/` staat een nabootsing van Supabase — een servertje met daarachter
een gewone Postgres waarin het echte schema draait — plus een reeks proeven
die de app in een browser bedienen. Zie `test/LEESMIJ.md`.

```sh
npm install
sh test/opzetten.sh      # database, nabootsing en webserver
sh test/proefschool.sh   # twee accounts en zes groepen om mee te proeven
sh test/alles.sh         # alle proeven, elk op een verse database
```

## Wat er niet in staat

Geen namen, foto's of planning van kinderen. Die leven in Supabase, achter
een login, gescheiden per school en per groep — met regels in de database
zelf, niet alleen in de app.
