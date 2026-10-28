/* ══════════════════════════════════════════════════════════════
   IETS MELDEN
   Eén knop waarmee een leerkracht kan zeggen dat er iets niet
   klopt, dat ze een idee heeft, of dat ze iets niet snapt.

   Waarom dit er is: tijdens een proefperiode hoor je anders
   alleen van de school die toevallig belt. De juf die denkt
   "het zal wel aan mij liggen" hoor je nooit, en juist die
   melding is de nuttigste.

   Wat er automatisch meegaat, en waarom het er niet bij hoeft
   te worden getypt: het scherm waar ze stond, welke uitgave ze
   had, en wat voor apparaat. Dat zijn de drie dingen die je
   anders per mail terug moet vragen, en dan is het al een week
   later.

   Wat er met opzet NIET meegaat:

   1. Geen schermafdruk. Een afdruk van een bord is een foto van
      een klas met namen erop. Die hoort niet bij de leverancier
      terecht te komen omdat iemand meldt dat een knop niet werkt.
   2. Geen enkel gegeven van een kind. Daarom staat er in het
      scherm ook met zoveel woorden dat ze geen namen moet
      opschrijven -- een melding is een tekstvak, en een tekstvak
      waarin je niets mag zetten moet dat zeggen.

   Waar de knop staat: in de zijbalk van het beheer, en in het
   menu van het bord -- dat menu zit achter de pincode en is dus
   al van de leerkracht. Niet los op het bord zelf: daar is elke
   plek die geen hoek is er een te veel, en kleuters staan er met
   hun handen bovenop.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var SOORTEN = [
  ['probleem',   'Er klopt iets niet'],
  ['vraag',      'Ik snap iets niet'],
  ['idee',       'Ik heb een idee'],
  ['compliment', 'Een compliment']
];

function el(tag, klasse, tekst){
  var n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
}

/* Welk scherm. De bestandsnaam en niet het hele adres: daar kan de
   naam van een school in staan, en het gaat erom welk scherm het was. */
function schermnaam(){
  var pad = (location.pathname || '').split('/').pop();
  return pad || 'index.html';
}

function versie(){
  if (global.KBTEST && KBTEST.versietekst) return KBTEST.versietekst(true);
  var a = global.KB_APP || {};
  return [a.versie, a.bouw].filter(Boolean).join(' · ');
}

/* Wat voor apparaat, in woorden die jij kunt gebruiken. De ruwe
   useragent sturen zou makkelijker zijn, maar dan staat er in jouw
   overzicht een regel van tweehonderd tekens waar niemand doorheen
   kijkt. Let op de volgorde: Chrome zet het woord Safari in zijn eigen
   useragent, dus Chrome moet eerst. */
function apparaat(){
  var ua = navigator.userAgent || '';
  var raak = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /iPhone/.test(ua)    ? 'iPhone'
      : /CrOS/.test(ua)      ? 'Chromebook'
      : /Android/.test(ua)   ? 'Android'
      : /Macintosh/.test(ua) ? 'Mac'
      : /Windows/.test(ua)   ? 'Windows'
      : /Linux/.test(ua)     ? 'Linux' : 'onbekend apparaat';
  var browser = /Edg\//.test(ua)     ? 'Edge'
      : /OPR\//.test(ua)             ? 'Opera'
      : /Chrome\//.test(ua)          ? 'Chrome'
      : /Firefox\//.test(ua)         ? 'Firefox'
      : /Safari\//.test(ua)          ? 'Safari' : 'onbekende browser';
  var maat = '';
  try { maat = ' · ' + screen.width + '×' + screen.height; } catch (e) {}
  return raak + ' · ' + browser + maat;
}

function metServer(){
  return !!(global.SB && SB.ingelogd && SB.ingelogd());
}

/* Een eigen overlay, los van die van de pagina. Elke pagina heeft er
   zelf een en die is op dat moment misschien in gebruik; twee schermen
   die om dezelfde bak vechten geeft een blad dat halverwege iets anders
   wordt. De vormgeving komt uit kb-stijl.css, dus hij ziet er overal
   hetzelfde uit. */
function bak(){
  var o = document.getElementById('fb-overlay');
  if (o) return o;
  o = el('div', 'overlay');
  o.id = 'fb-overlay';
  var blad = el('div', 'blad');
  blad.id = 'fb-blad';
  o.appendChild(blad);
  document.body.appendChild(o);
  o.addEventListener('click', function (e) { if (e.target === o) sluit(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && o.classList.contains('open')) sluit();
  });
  return o;
}
/* Open of dicht, ook op body -- zoals deze app zijn schermstanden
   overal bijhoudt (body.bord, body.beheer, body.rondleiding-open).

   Dat is hier geen sierlijkheid. Dit venster hangt náást dat van de
   pagina, en de proef in test/knoppen.test.js neemt een afdruk van het
   scherm waarin alleen het eigen venster van de pagina zit. Zonder deze
   klasse verandert er in die afdruk niets als je dit venster opent of
   sluit, en dan is Annuleren niet te onderscheiden van een knop die
   stuk is -- precies wat die proef hoort te vangen. */
function merkOp(open){
  if (document.body) document.body.classList.toggle('melden-open', !!open);
}

function sluit(){
  var o = document.getElementById('fb-overlay');
  if (o) o.classList.remove('open');
  merkOp(false);
}

function open(){
  var o = bak();
  var blad = document.getElementById('fb-blad');
  while (blad.firstChild) blad.removeChild(blad.firstChild);
  o.classList.add('open');
  merkOp(true);

  var titel = el('div', null, 'Iets melden');
  titel.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
  blad.appendChild(titel);

  if (!metServer()) {
    blad.appendChild(el('p', 'hint',
      'Hiervoor moet je ingelogd zijn én verbinding hebben. Probeer het ' +
      'zo nog eens — of bel ons gewoon even.'));
    var rij0 = el('div', 'knoprij-onder');
    var dicht = el('button', 'knop knop-stil knop-klein', 'Sluiten');
    dicht.addEventListener('click', sluit);
    rij0.appendChild(dicht);
    blad.appendChild(rij0);
    return;
  }

  blad.appendChild(el('p', 'hint',
    'Alles is welkom, ook als je denkt dat het aan jou ligt. Juist dan: ' +
    'als jij ergens over struikelt, struikelt de volgende er ook over.'));

  var gekozen = 'probleem';
  var soortrij = el('div', 'veldrij');
  soortrij.appendChild(el('label', 'veldlabel', 'Wat is het?'));
  var chips = el('div', 'knoprij');
  SOORTEN.forEach(function (paar) {
    var c = el('button', 'chip' + (paar[0] === gekozen ? ' aan' : ''), paar[1]);
    c.type = 'button';
    c.addEventListener('click', function () {
      gekozen = paar[0];
      [].forEach.call(chips.children, function (k) { k.classList.remove('aan'); });
      c.classList.add('aan');
    });
    chips.appendChild(c);
  });
  soortrij.appendChild(chips);
  blad.appendChild(soortrij);

  var tekstrij = el('div', 'veldrij');
  tekstrij.appendChild(el('label', 'veldlabel', 'Wat wil je kwijt?'));
  var tekst = el('textarea', 'invoer');
  tekst.id = 'fb-tekst';
  tekst.rows = 5;
  tekst.style.cssText = 'resize:vertical;min-height:110px;line-height:1.5';
  tekst.placeholder = 'Bijvoorbeeld: als ik een kind naar de bouwhoek sleep, springt hij terug.';
  tekstrij.appendChild(tekst);
  /* Dit staat er niet voor de vorm. Een tekstvak nodigt uit om een
     voorbeeld te geven, en het makkelijkste voorbeeld is een kind. */
  var pas = el('div', 'hint');
  pas.style.marginTop = '6px';
  pas.textContent = 'Schrijf hier geen namen van kinderen. Noem ze gerust "een kind".';
  tekstrij.appendChild(pas);
  blad.appendChild(tekstrij);

  var contactrij = el('div', 'veldrij');
  contactrij.appendChild(el('label', 'veldlabel', 'Mogen we je iets terugvragen? (mag leeg)'));
  var contact = el('input', 'invoer');
  contact.type = 'text'; contact.id = 'fb-contact';
  contact.placeholder = 'je e-mailadres of telefoonnummer';
  contactrij.appendChild(contact);
  blad.appendChild(contactrij);

  /* Wat er meegaat staat er gewoon bij. Een melding die stilletjes
     dingen meestuurt is een melding die je de volgende keer niet meer
     durft te versturen. */
  var mee = el('div', 'paneel');
  mee.style.cssText = 'margin-top:16px;padding:14px 16px';
  mee.appendChild(el('div', 'paneelkop', 'Dit gaat vanzelf mee'));
  var lijst = el('div', 'hint');
  lijst.textContent = 'Scherm: ' + schermnaam() +
    ' · Uitgave: ' + (versie() || 'onbekend') +
    ' · Apparaat: ' + apparaat() +
    ' · Je naam en je school · Het tijdstip.';
  mee.appendChild(lijst);
  var niet = el('div', 'hint');
  niet.style.marginTop = '6px';
  niet.textContent = 'Geen schermafdruk, en niets van de kinderen.';
  mee.appendChild(niet);
  blad.appendChild(mee);

  var melder = el('div', 'hint');
  melder.id = 'fb-melder';
  melder.style.marginTop = '10px';
  blad.appendChild(melder);

  var rij = el('div', 'knoprij-onder');
  var annuleer = el('button', 'knop knop-stil knop-klein', 'Annuleren');
  annuleer.addEventListener('click', sluit);
  rij.appendChild(annuleer);
  var stuur = el('button', 'knop knop-primair knop-klein', 'Versturen');
  stuur.id = 'fb-versturen';
  stuur.addEventListener('click', function () {
    var wat = (tekst.value || '').trim();
    if (!wat) {
      melder.textContent = 'Schrijf even op wat er aan de hand is.';
      melder.style.color = 'var(--stop)';
      tekst.focus();
      return;
    }
    stuur.disabled = true;
    stuur.textContent = 'Bezig…';
    melder.style.color = '';
    melder.textContent = '';
    SB.roep('feedback_sturen', {
      soort: gekozen, tekst: wat, contact: (contact.value || '').trim(),
      scherm: schermnaam(), versie: versie(), apparaat: apparaat()
    }).then(function () { bedankt(); }, function (e) {
      stuur.disabled = false;
      stuur.textContent = 'Versturen';
      melder.style.color = 'var(--stop)';
      melder.textContent = 'Versturen lukte niet: ' +
        ((e && e.message) || 'geen verbinding') + '. Probeer het zo nog eens.';
    });
  });
  rij.appendChild(stuur);
  blad.appendChild(rij);

  setTimeout(function () { tekst.focus(); }, 60);
}

function bedankt(){
  var blad = document.getElementById('fb-blad');
  while (blad.firstChild) blad.removeChild(blad.firstChild);
  var titel = el('div', null, 'Dank je wel');
  titel.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
  blad.appendChild(titel);
  blad.appendChild(el('p', 'hint',
    'Het staat bij ons. Je krijgt hier geen mail over — heb je iets ' +
    'achtergelaten om je op terug te bellen, dan doen we dat.'));
  var rij = el('div', 'knoprij-onder');
  var klaar = el('button', 'knop knop-primair knop-klein', 'Klaar');
  klaar.id = 'fb-klaar';
  klaar.addEventListener('click', sluit);
  rij.appendChild(klaar);
  blad.appendChild(rij);
  setTimeout(function () { klaar.focus(); }, 60);
}

/* De knop in de zijbalk. Boven Afmelden: dat is de laatste regel en dat
   hoort hij te blijven. */
function plaats(){
  var onder = document.querySelector('.zijbalk .zij-onder');
  if (!onder || onder.querySelector('.fb-knop')) return;
  var a = el('button', 'zij-link fb-knop');
  a.type = 'button';
  a.id = 'knop-melden';
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '17'); svg.setAttribute('height', '17');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  var pad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pad.setAttribute('d', 'M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.3A8.4 8.4 0 1 1 21 11.5z');
  svg.appendChild(pad);
  a.appendChild(svg);
  a.appendChild(document.createTextNode('Iets melden'));
  a.addEventListener('click', open);
  onder.insertBefore(a, onder.firstChild);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', plaats);
} else {
  plaats();
}

global.KBFEEDBACK = { open: open, sluit: sluit, plaats: plaats,
                      scherm: schermnaam, apparaat: apparaat, versie: versie };

})(window);
