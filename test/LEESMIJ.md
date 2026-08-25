# Zelf nakijken

De app praat met Supabase, en daar kan een testomgeving niet zomaar bij.
Daarom staat hier een nabootsing: een klein servertje dat precies de
adressen kent die `src/kb-supabase.js` gebruikt, met daarachter een gewone
Postgres waarin het echte `supabase/schema.sql` draait. De rechtenregels
zijn dus niet nagespeeld maar echt -- dezelfde regels die straks op de
server staan.

```sh
# een keer opzetten
createdb kb
psql -d kb -f supabase/test-01-nepsupabase.sql
psql -d kb -f supabase/schema.sql

# draaien
node test/nep-supabase-server.js &      # luistert op 5455
python3 -m http.server 8899 &           # de app zelf
node test/inloggen.test.js
```

De test loopt vijftien dingen langs: registreren, een school beginnen,
groepen maken, een juf uitnodigen, haar laten registreren en zien dat ze
automatisch bij de goede school en groep zit, dat ze niet bij de groep
hiernaast kan, verkeerd wachtwoord, opnieuw inloggen, een sessie die blijft
staan, een server die plat ligt, en een e-mailadres dat al bestaat.

## De synchronisatie

`test/sync.test.js` zet een groep in elkaar zoals de app dat doet --
kinderen, hoeken, een kind dat in de bouwhoek staat, instellingen, een taak
en een weekplan met een verdeling over de dagen -- stuurt die naar de
server, en haalt hem op een tweede apparaat weer op. Daarna wijzigen,
toevoegen, verwijderen, twee keer opsturen zonder wijziging, een server die
wegvalt en weer terugkomt, en een wijziging die de andere kant op reist.

Vierentwintig dingen, en die moeten alle vierentwintig uitkomen.

## De hele keten

`test/keten.test.js` doet het na zoals het in de klas gaat, en raakt
daarbij de synchronisatie nergens rechtstreeks aan -- alleen de schermen:

De juf logt in op haar laptop, komt in haar eigen beheer uit, en zet haar
kinderen en hoeken neer. Ze slaat één keer op; de rest hoort vanzelf te
gaan. Dan logt het digibord in, en daar staat haar groep: de vier hoeken
met het goede aantal plekken, de zes kinderen die nog moeten kiezen, en de
timer die zij aanzette. Een kind kiest de bouwhoek, en dat ziet de juf op
haar laptop. Tot slot logt de beheerder in en ziet alle zes de groepen.

Draai eerst `inrichten.sql` en maak de twee accounts aan, anders is er
niets om mee in te loggen:

```sh
sh test/opzetten.sh
psql -h /var/tmp -p 5439 -U postgres -d kb -f supabase/inrichten.sql
node test/keten.test.js
```
