# Zelf nakijken

De app praat met Supabase, en daar kan een testomgeving niet zomaar bij.
Daarom staat hier een nabootsing: een klein servertje dat precies de
adressen kent die `src/kb-supabase.js` gebruikt, met daarachter een gewone
Postgres waarin het echte `supabase/schema.sql` draait. De rechtenregels
zijn dus niet nagespeeld maar echt -- dezelfde regels die straks op de
server staan.

```sh
sh test/opzetten.sh        # database, nabootsing (5455) en webserver (8899)
sh test/proefschool.sh     # twee accounts en de zes groepen
node test/inloggen.test.js
```

`opzetten.sh` maakt de database elke keer opnieuw leeg, dus `proefschool.sh`
hoort er meteen achteraan: die maakt `beheerder@mijnschool.nl` en
`juf@mijnschool.nl` aan (wachtwoord `proefproef`) en draait `inrichten.sql`.
Zonder die stap is er niets om mee in te loggen en valt elke proef om op
"KB is not defined".

Alles achter elkaar, elke proef op een verse database:

```sh
sh test/alles.sh           # of: sh test/alles.sh doelen verslag
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

## Groepen die alleen in de browser staan

`test/losgeraakt.test.js` speelt na wat er in de klas misging. Iemand had
eerst zonder account zitten proeven en groepen aangemaakt; die stonden
alleen in die ene browser. Na het inloggen zag hij ze wél staan, maar
openen en een leerkracht toewijzen ketsten af met "staat niet op de
server". De test zet zulke losse groepen klaar, logt in, en kijkt of ze nu
apart staan met uitleg, of de servergroepen wél werken, en of je een losse
groep alsnog naar de server kunt brengen.

## Doelen bij een taak

`test/doelen.test.js` maakt een taak in een groep waar nog geen enkel doel
is aangevinkt -- vroeger kon je dan niets kiezen. Nu staat de hele lijst
open: bladeren via domein en leerlijn, zoeken op een woord, en suggesties
uit wat je hebt opgeschreven. Typ "de kinderen knippen een blad uit" en
"Experimenteren met knippen" staat er als suggestie onder.

## Werkmomenten en de verdeling

`test/werkmomenten.test.js` gaat over de week zoals hij op school loopt:
twee werkmomenten op maandag, dinsdag en donderdag, één op woensdag en
vrijdag. De proef kijkt of het automatisch verdelen daar rekening mee
houdt, of je die aantallen zelf kunt bijstellen, of de tweede ronde in het
grijs achter de eerste verschijnt zodra een kind zijn plaatje weghaalt, en
of alles ook weer uit te zetten is.

## Statistieken

`test/statistiek.test.js` zet een week aan gebeurtenissen klaar en telt na:
hoe vaak een kind koos en welke hoek zijn favoriet is, welk tweetal het
meest samen zat, wie niemand tegenkwam, wie helemaal niets koos, en of dat
alles ook op het scherm terechtkomt.

## Alles één keer langs

`test/doorloop.test.js` opent elk scherm en elk paneel één keer, en let
onderweg op alles wat omvalt: fouten op de pagina, fouten in de console,
en panelen die leeg blijven. Niet op zoek naar één ding, maar naar wat er
kapot is zonder dat iemand het weet.

Drieëntwintig punten: de drie onderdelen van het schoolbeheer, alle elf
panelen van het groepsbeheer, het bord met een kind dat een hoek kiest, het
bordmenu, het testbord, en tot slot dezelfde ronde als leerkracht om te
zien dat zij alleen haar eigen groep krijgt en meteen op het bord uitkomt.

## Het verslag voor het oudergesprek

`test/verslag.test.js` gaat na of er uit de observaties een blaadje komt
dat je aan een ouder kunt meegeven. Eenendertig dingen: welke doelen als
behaald en welke als "bezig" op het blad komen (ook een taak waar geen doel
aan hangt), dat "waar we nog aan gaan werken" alleen pakt wat nog open
staat, dat de hoeken op volgorde van vaak naar minder vaak staan met het
speelmaatje en de minuten erbij, dat elk kind zijn eigen blad krijgt, dat
de stukken die je uitzet er ook echt uit gaan, dat een naam met een `<`
erin veilig door de opmaak komt, en dat een kind dat nog niets koos een
nette zin krijgt in plaats van een lege lijst.

Onderweg gaat alles ook één keer naar de server en terug. Dat is geen
bijvangst: een taak zonder doel staat in de beoordelingen als
`<kind>|taak:<taak>`, en dat is geen uuid. Zonder de vertaling naar een
observatie zonder `doel_id` viel de hele push om.

Daarna de weg ernaartoe: de knop in Observaties opent het venster met alle
kinderen aangevinkt, "Niemand" vinkt ze uit, en bij een kind in
Statistieken staat een knop die alleen dát kind aanvinkt. Afdrukken zelf
gebeurt in een verborgen kader dat zichzelf daarna opruimt -- de proef
kijkt of het blad erin staat en op A4 gezet is.
