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
  bouw: '38901284',
  panelen: ['statistiek','leerlingen','pictos','hoeken','uiterlijk','groep','functies'],
  ander: { id:'planbord', naam:'Planbord', adres:'../planbord/' }
};
