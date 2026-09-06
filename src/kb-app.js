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
  bouw: '95be818a',
  /* Heeft deze uitgave het bord zelf? Planbord niet -- daar wijst een
     knop "Bord openen" naar de andere app, met de groep mee. */
  heeftBord: true,
  panelen: ['statistiek','leerlingen','pictos','hoeken','uiterlijk','groep','functies'],
  /* Waar beide uitgaven staan. Volledige adressen, met de mapnaam er los
     bij als terugval voor een testserver of een ander domein. Dit is de
     enige plek waar die adressen staan. */
  apps: {
    keuzebord: { naam:'Keuzebord', map:'keuzebord-app', url:'https://tomhooijer-svg.github.io/keuzebord-app/' },
    planbord:  { naam:'Planbord',  map:'planbord', url:'https://tomhooijer-svg.github.io/planbord/' }
  },
  ander: 'planbord'
};
