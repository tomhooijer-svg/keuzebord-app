/* Welke app dit is. Geschreven door test/uitgeven.sh -- pas de
   werkplaats aan, niet dit bestand.

   Keuzebord is één van twee uitgaven van dezelfde motor. Ze delen de
   gegevens, de database en het inloggen; de splitsing zit in de
   schermen. Allebei mogen ze alles lezen -- ze laten alleen wat
   anders zien. */
window.KB_APP = {
  id: 'keuzebord',
  naam: 'Keuzebord',
  panelen: ['statistiek','leerlingen','pictos','hoeken','uiterlijk','groep','functies'],
  ander: { id:'planbord', naam:'Planbord', adres:'../planbord/' }
};
