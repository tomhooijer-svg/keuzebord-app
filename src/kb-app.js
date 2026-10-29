/* Welke app dit is. Geschreven door test/uitgeven.sh -- pas de
   werkplaats aan, niet dit bestand.

   Keuzebord is één van twee uitgaven van dezelfde motor. Ze delen de
   gegevens, de database en het inloggen; de splitsing zit in de
   schermen. Allebei mogen ze alles lezen -- ze laten alleen wat
   anders zien. */
window.KB_APP = {
  id: 'keuzebord',
  naam: 'Keuzebord',
  /* De vingerafdruk van de code in deze uitgave. Staat onder in het
     bordmenu en bij Groep, zodat je twee uitgaven van dezelfde dag uit
     elkaar kunt houden -- en kunt zien of een wijziging bij je is
     aangekomen. */
  bouw: '2abc4ee7',
  /* De datum die de leerkracht herkent. Staat samen met de
     bouwvingerafdruk in de testchip, zodat je bij een melding weet
     welke code ze voor zich had. */
  versie: '22 oktober 2026',
  /* Draait deze uitgave op proef? Zie src/kb-testbanner.js. */
  testversie: true,
  /* Heeft deze uitgave het bord zelf? Planbord niet -- daar wijst een
     knop "Bord openen" naar de andere app, met de groep mee. */
  heeftBord: true,
  panelen: ['vandaag','statistiek','leerlingen','pictos','hoeken','uiterlijk','groep','functies'],
  planbord: false,
  /* Waar beide uitgaven staan. Volledige adressen, met de mapnaam er los
     bij als terugval voor een testserver of een ander domein. Dit is de
     enige plek waar die adressen staan. */
  apps: {
    keuzebord: { naam:'Keuzebord', map:'keuzebord-app', url:'https://tomhooijer-svg.github.io/keuzebord-app/',
                 ook:['https://app.pixelplein.nl/'] },
    planbord:  { naam:'Planbord',  map:'planbord', url:'https://tomhooijer-svg.github.io/planbord/' }
  },
  ander: 'planbord',
  /* De verhuizing naar het nieuwe adres. Staat 'aan' op true, dan ziet
     wie op het oude adres werkt een melding: eerst versturen, dan pas
     overstappen. Zie src/kb-verhuizing.js. */
  verhuizing: { aan:false, van:'https://tomhooijer-svg.github.io/keuzebord-app/', naar:'https://app.pixelplein.nl/' }
};
