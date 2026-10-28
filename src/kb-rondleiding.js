/* ══════════════════════════════════════════════════════════════
   DE RONDLEIDING
   Vijf schermen voor wie hier voor het eerst komt. Niet meer dan
   vijf: wie er zes nodig heeft om een keuzebord uit te leggen,
   heeft geen rondleiding nodig maar een eenvoudiger product.

   Wat dit met opzet NIET is: een rondleiding die pijltjes op
   knoppen zet. Die ziet er goed uit op de dag dat je hem maakt
   en wijst een half jaar later naar een knop die er niet meer
   staat -- en dan wijst hij een leerkracht de verkeerde kant op
   terwijl hij het zelfverzekerd doet. Dit zijn vijf kaarten die
   vertellen wát je gaat doen en wáár het staat; het aanwijzen
   laat ik aan de woorden.

   Hij komt één keer vanzelf, bij de eerste keer in het beheer.
   Daarna staat hij in de handleiding, onder "Laat me in vijf
   stappen zien" -- want de keer dat je hem nodig hebt is zelden
   de keer dat hij vanzelf komt.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var SLEUTEL = 'kb_rondleiding';

var STAPPEN = [
  { kop:'Je werkt per groep',
    tekst:'Links staat het menu van deze groep. Alles wat je hier doet — kinderen, ' +
          'hoeken, thema’s — hoort bij die ene groep. Heb je meer groepen, dan ' +
          'wissel je bovenin.',
    waar:'Het menu links' },
  { kop:'Zet de kinderen erin',
    tekst:'Bij Leerlingen voeg je ze toe. Je kunt ook een lijst met namen plakken ' +
          'of een Word-bestand inlezen — dan staan ze er in één keer in. Elk kind ' +
          'krijgt een kleur, en een picto als je wilt: handig voor wie nog niet leest.',
    waar:'Menu → Leerlingen' },
  { kop:'Richt je hoeken in',
    tekst:'Bij Hoeken zeg je welke hoeken er zijn en hoeveel kinderen erin mogen. ' +
          'Is een hoek vol, dan kan een kind in de rij — dat regelt het bord zelf. ' +
          'Je kunt ook hoeken overnemen uit de databank.',
    waar:'Menu → Hoeken' },
  { kop:'Zet het bord in de klas',
    tekst:'Met Bord openen krijg je het scherm dat de kinderen zien. Zet dat op het ' +
          'digibord en log daar één keer in; daarna blijft het ingelogd. De kinderen ' +
          'slepen hun eigen plaatje naar een hoek.',
    waar:'Bord openen, bovenin' },
  { kop:'En daarna kijk je terug',
    tekst:'Bij Vandaag zie je wat er nu gebeurt, bij Statistieken waar een kind ' +
          'speelt, hoe lang en met wie. Loop je ergens tegenaan, gebruik dan ' +
          '"Iets melden" links onderin — ook als je denkt dat het aan jou ligt.',
    waar:'Menu → Vandaag en Statistieken' }
];

function el(tag, klasse, tekst){
  var n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
}

function gezien(){
  try { return localStorage.getItem(SLEUTEL) === 'ja'; } catch (e) { return true; }
}
function onthoud(){
  try { localStorage.setItem(SLEUTEL, 'ja'); } catch (e) {}
}

/* De kaart staat in de stroom van de pagina, bovenaan de inhoud, en
   nadrukkelijk niet als venster over het scherm en ook niet zwevend in
   een hoek.

   Die hoek heb ik geprobeerd en weer weggehaald. Hij zag er goed uit en
   hij dekte een knop af: op het scherm Vandaag lag hij precies over
   "Taak inplannen". Dat is niet half erg -- dat is een leerkracht die
   op een knop drukt en niets ziet gebeuren, op haar eerste dag, door
   iets wat haar zou moeten helpen. Een proef (test/opslagstand.test.js)
   liep er als eerste tegenaan; zij zag wat een mens ook zou zien.

   In de stroom kan dat niet. De kaart duwt de inhoud omlaag in plaats
   van eroverheen te liggen, en er is geen enkele plek waar iets
   onbereikbaar wordt.

   Het beheer tekent zijn inhoud telkens opnieuw -- bij elke klik in het
   menu -- en gooit de kaart daarmee weg. Daarom kijkt een waarnemer mee
   en zet hem er weer in. Dat is minder mooi dan een haakje in het
   beheer zelf, maar het houdt de rondleiding een losse laag die je in
   één regel uit een pagina haalt. */
var KIJKER = null;

function plek(){
  return document.getElementById('inhoud') || document.body;
}

function kaart(){
  var k = document.getElementById('rl-kaart');
  if (k && k.parentNode === plek()) return k;
  if (k) k.remove();
  k = el('aside', 'rl-kaart');
  k.id = 'rl-kaart';
  k.setAttribute('aria-label', 'Rondleiding');
  var waar = plek();
  waar.insertBefore(k, waar.firstChild);
  return k;
}

/* Blijven kijken of de kaart er nog staat. Het beheer veegt zijn inhoud
   leeg bij elke menuklik, en een rondleiding die halverwege verdwijnt is
   geen rondleiding. */
function blijfKijken(){
  if (KIJKER || typeof MutationObserver === 'undefined') return;
  var vak = document.getElementById('inhoud');
  if (!vak) return;
  KIJKER = new MutationObserver(function () {
    if (huidigeStap < 0) return;
    if (!document.getElementById('rl-kaart')) toon(huidigeStap);
  });
  KIJKER.observe(vak, { childList: true });
}
function stopKijken(){
  if (KIJKER) { KIJKER.disconnect(); KIJKER = null; }
}

var huidigeStap = -1;

function merkOp(n){
  var b = document.body;
  if (!b) return;
  b.classList.toggle('rondleiding-open', n >= 0);
  for (var i = 0; i < STAPPEN.length; i++) {
    b.classList.toggle('rondleiding-' + (i + 1), i === n);
  }
}

function stop(){
  onthoud();
  huidigeStap = -1;
  stopKijken();
  var k = document.getElementById('rl-kaart');
  if (k) k.remove();
  merkOp(-1);
}

function toon(n){
  huidigeStap = n;
  var k = kaart();
  while (k.firstChild) k.removeChild(k.firstChild);
  merkOp(n);
  blijfKijken();

  var s = STAPPEN[n];

  var kop = el('div', 'rl-kop');
  kop.appendChild(el('span', 'rl-teller', 'Stap ' + (n + 1) + ' van ' + STAPPEN.length));
  var weg = el('button', 'rl-weg', '\u00d7');
  weg.id = 'rl-overslaan';
  weg.type = 'button';
  weg.title = 'Rondleiding sluiten';
  weg.setAttribute('aria-label', 'Rondleiding sluiten');
  weg.addEventListener('click', stop);
  kop.appendChild(weg);
  k.appendChild(kop);

  k.appendChild(el('div', 'rl-titel', s.kop));
  k.appendChild(el('div', 'rl-waar', s.waar));
  k.appendChild(el('p', 'rl-tekst', s.tekst));

  var bolletjes = el('div', 'rl-bolletjes');
  for (var i = 0; i < STAPPEN.length; i++) {
    bolletjes.appendChild(el('span', 'rl-bol' + (i === n ? ' aan' : '')));
  }
  k.appendChild(bolletjes);

  var rij = el('div', 'rl-knoppen');
  if (n > 0) {
    var vorige = el('button', 'knop knop-stil knop-klein', 'Vorige');
    vorige.id = 'rl-vorige';
    vorige.type = 'button';
    vorige.addEventListener('click', function () { toon(n - 1); });
    rij.appendChild(vorige);
  }
  var verder = el('button', 'knop knop-primair knop-klein',
                  n < STAPPEN.length - 1 ? 'Verder' : 'Aan de slag');
  verder.id = 'rl-verder';
  verder.type = 'button';
  verder.addEventListener('click', n < STAPPEN.length - 1
    ? function () { toon(n + 1); }
    : stop);
  rij.appendChild(verder);
  k.appendChild(rij);
}

function start(){ toon(0); }

/* Vanzelf, maar alleen de eerste keer, alleen in het beheer, en alleen
   bij een groep waar nog geen kinderen in staan. Dat laatste is wat
   "de eerste keer" betekent: wie al een klas heeft ingericht is hier
   niet nieuw, ook niet op een nieuwe laptop.

   En niet meteen: eerst het scherm laten staan. Een rondleiding die
   over een leeg scherm valt legt niets uit. */
function nogGeenKinderen(){
  try {
    var k = global.KB && KB.klas && KB.klas();
    return !!k && !(k.leerlingen || []).length;
  } catch (e) { return false; }
}
function misschien(){
  if (gezien()) return;
  if (location.pathname.indexOf('beheer.html') < 0) return;
  setTimeout(function () { if (nogGeenKinderen()) start(); }, 1400);
}

function vanafAdres(){
  if (location.search.indexOf('rondleiding=1') >= 0) {
    setTimeout(start, 500);
    return true;
  }
  return false;
}

function opstarten(){
  if (!vanafAdres()) misschien();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', opstarten);
} else {
  opstarten();
}

global.KBRONDLEIDING = { start: start, stop: stop, gezien: gezien, STAPPEN: STAPPEN };

})(window);
