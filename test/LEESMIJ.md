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

## Thema's

`test/themas.test.js` loopt een heel thema door zoals je het bij
thematisch onderzoekend leren uitwerkt: verwonderen, vragen, onderzoeken,
betekenis geven. Vierentwintig dingen. Een thema maken, de startactiviteit
opschrijven, vragen op de muur hangen en er een afvinken, hoeken eraan
koppelen, een activiteit met zijn soort, een taak die eraan hangt, doelen
kiezen, en het overzicht dat laat zien waar het thema staat. Daarna de
hele reis naar de server en terug -- inclusief de vragenmuur en de
activiteiten, die als jsonb meegaan -- en tot slot afsluiten en
terugvinden onder "Geweest".

## Het bord aan- en uitzetten

`test/aanuit.test.js` gaat over de knop rechtsboven op het bord.
Uitzetten lukte wel, aanzetten niet: het pauzevlak lag over de knop heen.
De proef klikt daarom niet via JavaScript maar kijkt met
`elementFromPoint` wat er werkelijk bovenop ligt -- anders zou hij deze
fout niet vangen.

Vijftien dingen: aan, uit, het pauzevlak dat komt en gaat, de knop die
bereikbaar blijft terwijl het bord uit staat, de viercijferige code die
er in beide richtingen op zit (met een verkeerde code die niets doet),
hetzelfde via het bordmenu, en tot slot dat een uitgezet bord na een
herlaadbeurt nog steeds uit staat -- die stand reisde niet mee naar de
server, dus een bord dat je 's middags uitzette stond de volgende
ochtend weer aan.

## De zware proef

`test/zwaar.test.js` is geen functietest maar een belastingtest. Zes
groepen tegelijk, elk met vijftien hoeken met een foto erin,
vijfentwintig kinderen, per hoek en per bord een andere timer, functies
die per bord anders aanstaan, twee thema's met vragen en activiteiten,
zes taken en vier weken vooruit gepland, plus vijftien dagen aan
gebeurtenissen en observaties.

Dan gaan alle zes de groepen naar de server, worden zes borden tegelijk
geopend, kiezen er op elk bord kinderen een hoek, wordt er met de muis
gesleept, en sturen alle zes de borden tegelijk op. Tot slot haalt een
vers apparaat alles op en gaan de zware schermen open.

Er wordt op drie dingen gelet: gaat er iets stuk (fouten op de pagina en
in de console worden allemaal opgevangen), wordt het traag (elke stap
wordt geklokt), en klopt het nog na het ophalen (geen dubbele rijen, alles
compleet). Draaien:

```sh
sh test/opzetten.sh && sh test/proefschool.sh
node test/zwaar.test.js
```

Groter maken kan met omgevingsvariabelen: `GROEPEN=6 HOEKEN=20
KINDEREN=30 WEKEN=8 BORDEN=6 node test/zwaar.test.js`.

## Tot het breekt

`test/uiterste.test.js` gaat niet na of het werkt maar wáár de grens
ligt, en wat er gebeurt als je eroverheen gaat. Er wordt net zo lang een
hoek met foto, drie kinderen en veertig logregels bij gestapeld tot de
browseropslag het opgeeft.

Wat daaruit kwam:

- Eén groep houdt **54 hoeken met foto en 161 kinderen** vast voordat de
  vijf megabyte van localStorage vol is -- en dat is dan nog zonder ook
  maar één keer te synchroniseren. Een kleutergroep heeft er vijftien.
- Zodra de foto's in de fotokluis staan, slinkt localStorage van 5116 KB
  naar 293 KB. Dat is de reden dat `bewaarInKluis` de foto's daarna als
  "ligt in de kluis" merkt: dan mogen ze uit localStorage weg, en zet
  `fkPasToe` ze bij het opstarten weer terug.
- Zit het toch vol, dan valt er niets om. `bewaar()` pelt af in de
  volgorde van wat het makkelijkst te missen is -- eerst foto's die al in
  de kluis liggen, dan het logboek van groepen waar je niet in werkt, dan
  hun hele inhoud -- en raakt nooit iets aan wat nog niet op de server
  staat. Lukt het dan nog niet, dan zegt de app dat en vraagt een ronde
  versturen aan.
- Een groep die zo is uitgekleed wordt **nooit** opgestuurd. Zou dat wel
  gebeuren, dan las het verschil "alles is weg" en veegde het de hele
  groep van de server. Hij wordt eerst opnieuw opgehaald.

## Alles één keer langs

`test/doorloop.test.js` opent elk scherm en elk paneel één keer, en let
onderweg op alles wat omvalt: fouten op de pagina, fouten in de console,
en panelen die leeg blijven. Niet op zoek naar één ding, maar naar wat er
kapot is zonder dat iemand het weet.

Vijfentwintig punten: de drie onderdelen van het schoolbeheer, alle
dertien panelen van het groepsbeheer, het bord met een kind dat een hoek
kiest, het bordmenu, het testbord, en tot slot dezelfde ronde als
leerkracht om te zien dat zij alleen haar eigen groep krijgt en meteen op
het bord uitkomt.

## De juf mag de timer overrulen

Staat de timer aan, dan zit een kind vast tot het rondje vol is. Dat is
de bedoeling -- daar is de timer voor. Maar niet als het misgaat in de
bouwhoek, als er iemand naar de logopedist moet, of als de kring eerder
begint. Een timer die niet te doorbreken is, is geen hulpmiddel maar een
baas.

Er zijn twee wegen naar dezelfde keuze, en allebei zitten ze achter de
code van het bord:

- Probeer je een vastzittend kind te verslepen, dan zegt het bord "nog
  even". Onder die uitleg staat klein en grijs "Juf: toch eruit halen".
- Tik je in het hoekvenster op een kind, dan kom je op dezelfde plek uit.

Daar kies je "De timer is klaar voor ‹naam›" of "Uit de hoek halen".

Het afronden gebeurt door de starttijd van dat kind terug te zetten, niet
door er een uitzondering naast te bewaren. Zo staat er maar op één plek
hoe lang iemand ergens zit, en klopt het rondje op het bord er meteen
mee. Alleen dat ene kind in die ene hoek verandert; de timer van de rest
loopt door. Dat laatste wordt in `test/juf.test.js` apart nagegaan.

Vierentwintig punten, waaronder: een verkeerde code laat de timer staan
en laat de keuze niet zien, na het afronden verhuist het kind ook echt,
uit de hoek halen zet hem terug in de strook, en zonder timer werkt het
gewoon ook.

## Elke knop apart

`test/doorloop.test.js` kijkt of elk scherm heel opengaat.
`test/knoppen.test.js` gaat een stap verder: die drukt in elk paneel
alles in wat een mens kan indrukken, en kijkt of er daarna iets ánders
is -- een venster dat opengaat, een melding, een scherm dat verandert,
gegevens die veranderen. Gebeurt er niets, dan staat die knop met naam en
al in de uitslag.

Tussen elke klik gaan de gegevens terug zoals ze waren. Daardoor mag
alles ingedrukt worden, ook "Verwijderen": het kind is een tel later weer
terug en de volgende knop treft hetzelfde scherm aan als de vorige.

Wat een knop is, is met opzet ruim genomen: een echte `<button>`, een
link, een schakelaar, en alles waar de muisaanwijzer een handje van
maakt. Vakjes die alleen iets laten zien -- de dagen in het weekplan --
horen er niet bij.

De knoppen in de vensters worden apart nagelopen. Merkt de proef dat een
knop een venster opent, dan komt hij daar een voor een op terug: venster
openen, één knop erin indrukken, meten, opnieuw. Zonder dat rondje bleef
alles wat achter "Nieuwe taak" of "Bewerken" zit ongemoeid -- en daar
zitten juist Opslaan, Annuleren en Verwijderen.

Drie dingen tellen niet mee als "doet niets", en dat is geen coulance
maar een eerlijke grens:

- **Wat geen klik vangt.** Een gesloten venster staat nog in de pagina,
  doorzichtig en met `pointer-events: none`. Een mens kan er niet op
  klikken; de proef kon dat wel, en meldde de knoppen erin als dood.
- **Wat al aanstaat.** Het menu-item waar je staat, de stap die open is,
  de kleur die al gekozen is. Daar hoort niets van te gebeuren.
- **Wat een venster van het apparaat opent.** Een bestandskiezer of het
  kleurenpalet van het besturingssysteem valt buiten de pagina. Dat de
  knop het opent, is wél te merken, en dat wordt geteld.

Bij het bouwen van deze proef zaten de fouten eerst in de proef zelf. De
vingerafdruk keek naar de *lengte* van de gegevens, en `warm` -> `koel`
is even lang, net als `#3b6ff0` -> `#ff8a3d`: alle kleurknoppen leken
niets te doen. En er werd geteld hoevéél er aanstond, niet wát: gaat er
in een rij kleuren één uit en één aan, dan blijft dat aantal gelijk.

Eén echte vondst: de teller bij "aantal plekken" en "werkmomenten" liet
je op de − blijven drukken als hij al op zijn laagste stand stond. Die
knop wordt nu grijs.

Draaien:

```sh
sh test/opzetten.sh && sh test/proefschool.sh
node test/knoppen.test.js
```

Een hele ronde is **709 knoppen over zeventien schermen** en duurt zo'n
twintig minuten -- de vensterknoppen kosten elk een eigen heropening. Hij
staat in `test/alles.sh`, maar dat is meteen de reden dat die ronde
tegenwoordig ruim een half uur loopt.

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
