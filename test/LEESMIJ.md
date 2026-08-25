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

## De schoolbeheerder

`test/beheerder.test.js` gaat na of een schoolbeheerder werkelijk overal
bij mag, en of hij leerkrachten aan groepen kan hangen. Dertien dingen: hij
ziet alle zes de groepen, opent het bord van een groep die niet van hem is
en ziet daar de kinderen van de juf, opent het beheer van weer een andere
groep, hangt de juf aan een tweede groep waarna die ook bij haar opduikt,
en een leerkracht die zelf iemand probeert toe te wijzen wordt geweigerd.

## Accounts

`test/accounts.test.js` gaat de hele weg langs die een nieuwe collega
aflegt: de beheerder ziet zijn eigen naam staan, nodigt iemand uit op haar
e-mailadres met een groep erbij, en die uitnodiging verschijnt in de lijst.
Zij meldt zich aan en komt binnen bij precies die groep, met haar naam en
rol onderin het scherm. De uitnodiging verdwijnt uit de lijst en zij staat
tussen de accounts. Daarna uitloggen, als iemand anders inloggen, en
controleren dat het bordmenu ook een uitlogknop heeft.

## Browsers

`test/browsers.test.js` opent het bord en loopt achttien dingen af die deze
app van een browser vraagt.

Let op wat dit wel en niet zegt. Het draait in Chromium, en dat is de motor
van zowel Chrome als Edge -- die twee zijn daarmee gedekt. **Firefox en
Safari zijn hier niet te installeren**, dus die zijn niet nagelopen. Draai
daarvoor `testbord.html` op zo'n browser en druk op "Wat kan dit bord?":
daar staat dezelfde lijst, met de naam van de browser erboven.
