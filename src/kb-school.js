/* ══════════════════════════════════════════════════════════════
   SCHOOLBEHEER
   Voor wie over alle groepen gaat. Groepen aanmaken, zien hoe ze
   ervoor staan, en per apparaat instellen welke groep er beheerd
   wordt. De leerkrachtomgeving zelf kent maar één groep.
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

function $(id){ return document.getElementById(id); }
function el(tag, klasse, tekst){
  var n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
}
function leeg(n){ while (n && n.firstChild) n.removeChild(n.firstChild); return n; }

var meldingTimer = null;
function meld(t){
  var m = $('melding'); m.textContent = t; m.classList.add('zichtbaar');
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(function () { m.classList.remove('zichtbaar'); }, 2800);
}
function bewaar(){ if (!KB.bewaar()) meld('De opslag van deze browser zit vol'); }

function toonBlad(bouw){
  var blad = leeg($('blad'));
  bouw(blad);
  $('overlay').classList.add('open');
}
function sluitBlad(){ $('overlay').classList.remove('open'); }
$('overlay').addEventListener('click', function (e) { if (e.target.id === 'overlay') sluitBlad(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluitBlad(); });

/* In de voorvertoning staan de drie omgevingen in één pagina; daar wordt
   navigeren opgevangen. Op een echte server is het gewoon een andere pagina. */
function gaNaar(pagina){
  if (window.KB_PREVIEW_GA) { window.KB_PREVIEW_GA(pagina); return; }
  location.href = pagina;
}

function knop(tekst, soort, doen){
  var b = el('button', 'knop knop-' + (soort || 'stil') + ' knop-klein', tekst);
  b.addEventListener('click', doen);
  return b;
}
function vraagBevestiging(titel, uitleg, knoptekst, doen){
  toonBlad(function (blad) {
    var t = el('div', null, titel);
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint', uitleg)).style.marginBottom = '22px';
    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop(knoptekst, 'gevaar', function () { sluitBlad(); doen(); }));
    blad.appendChild(rij);
  });
}

/* ── de zes kleutergroepen ───────────────────────────────── */
var GROEPCODES = ['1A','1B','1C','2A','2B','2C'];
var GROEPKLEUREN = { '1A':'#3b6ff0', '1B':'#2e9e6b', '1C':'#c8820a',
                     '2A':'#7c5cbf', '2B':'#1a9aad', '2C':'#b8436d' };
var TESTKINDEREN = ['Bram','Isa','Kees','Yara','Otis','Loua','Sam','Fenne','Joep','Nora',
                    'Timo','Wies','Levi','Roos','Cas','Maud','Bas','Lotte'];
var STANDAARDHOEKEN = [['Bouwhoek',4],['Huishoek',3],['Zandtafel',4],
                       ['Knutselhoek',4],['Leeshoek',3]];

function codeVan(klas){
  var m = (klas.naam || '').match(/([12][ABC])/i);
  return m ? m[1].toUpperCase() : null;
}

/* De zes kleutergroepen neerzetten. Zijn we ingelogd, dan komen ze op de
   server te staan -- anders zouden ze alleen in deze ene browser bestaan
   en zou niemand ze kunnen openen. Zonder verbinding maken we ze lokaal,
   zoals vroeger, zodat je ook zonder account kunt proeven. */
function maakSchoolgroepen(metTestkinderen){
  if (!metServer()) { maakLokaleGroepen(metTestkinderen); return Promise.resolve(); }

  var schoolId = KBV.wie().profiel.school_id;
  meld('Bezig met de zes groepen aanmaken…');

  // eerst weg wat er al staat, anders komen ze er dubbel bij
  return SB.lees('groepen', { kies:'id' }).then(function (bestaand) {
    var wissen = (bestaand || []).map(function (g) {
      return SB.wis('groepen', { id:'eq.' + g.id });
    });
    return Promise.all(wissen);
  }).then(function () {
    return SB.schrijf('groepen', GROEPCODES.map(function (code, i) {
      return { school_id: schoolId, naam: 'Groep ' + code, volgorde: i + 1 };
    }));
  }).then(function (nieuweGroepen) {
    // elke groep begint met een leeg keuzebord
    return SB.schrijf('borden', (nieuweGroepen || []).map(function (g) {
      return { groep_id: g.id, naam: 'Keuzebord', actief: true };
    })).then(function () { return nieuweGroepen; });
  }).then(function (nieuweGroepen) {
    // de lokale kant opnieuw opbouwen vanaf de server
    KB.G.klassen = [];
    try { localStorage.removeItem('kb_koppeling'); } catch (e) {}
    return KBV.herstart();
  }).then(function () {
    // hoeken en eventueel testkinderen erin, en meteen naar de server
    var werk = Promise.resolve();
    KB.G.klassen.forEach(function (k) {
      var code = codeVan(k);
      k.doelNiveaus = KB.NIVEAUS_PER_GROEP[code.charAt(0)] || KB.NIVEAUS_PER_GROEP[2];
      k.hoekLib = STANDAARDHOEKEN.map(function (h, i) {
        return { id:'hl-' + code.toLowerCase() + '-' + i, naam:h[0], maxKinderen:h[1],
                 timerMinuten:0, fotoId:null };
      });
      var b = k.borden[0];
      b.hoekLibIds = k.hoekLib.map(function (h) { return h.id; });
      k.hoekLib.forEach(function (h) { b.plaatsingen[h.id] = []; });
      KB.zorgVoorWerkplaats(k);
      if (metTestkinderen && code === '1A') {
        TESTKINDEREN.forEach(function (naam, i) {
          k.leerlingen.push({ id:'ll-1a-' + i, naam:naam,
            kleur: KB.KIND_KLEUREN[i % KB.KIND_KLEUREN.length], image:null, lid:true });
        });
      }
      werk = werk.then(function () {
        return KBSYNC.duw(k.id, KBSYNC.opServer(k.id), schoolId);
      });
    });
    KB.bewaar();
    return werk;
  }).then(function () {
    if (KB.G.klassen[0]) KB.zetBeheerKlas(KB.G.klassen[0].id);
    bewaar();
    return haalMensen();
  });
}

/* Zonder verbinding: alleen in deze browser. */
function maakLokaleGroepen(metTestkinderen){
  KB.G.klassen = [];
  GROEPCODES.forEach(function (code) {
    var k = KB.leegKlas('Groep ' + code);
    k.doelNiveaus = KB.NIVEAUS_PER_GROEP[code.charAt(0)] || KB.NIVEAUS_PER_GROEP[2];
    k.hoekLib = STANDAARDHOEKEN.map(function (h, i) {
      return { id:'hl-' + code.toLowerCase() + '-' + i, naam:h[0], maxKinderen:h[1],
               timerMinuten:0, fotoId:null };
    });
    var b = k.borden[0];
    b.hoekLibIds = k.hoekLib.map(function (h) { return h.id; });
    k.hoekLib.forEach(function (h) { b.plaatsingen[h.id] = []; });
    KB.G.klassen.push(k);
    KB.G.activeKlasId = k.id;
    KB.zorgVoorWerkplaats(k);
    if (metTestkinderen && code === '1A') {
      TESTKINDEREN.forEach(function (naam, i) {
        k.leerlingen.push({ id:'ll-1a-' + i, naam:naam,
          kleur: KB.KIND_KLEUREN[i % KB.KIND_KLEUREN.length], image:null, lid:true });
      });
    }
  });
  KB.zetBeheerKlas(KB.G.klassen[0].id);
  bewaar();
}

/* Een groep die alleen in deze browser bestaat alsnog naar de server
   brengen. Gebeurt bij wie eerst zonder account heeft zitten proeven. */
function brengNaarServer(k){
  if (!metServer()) return;
  var schoolId = KBV.wie().profiel.school_id;
  meld('Bezig met ' + k.naam + ' naar de server brengen…');
  SB.schrijf('groepen', [{ school_id: schoolId, naam: k.naam,
                           volgorde: KB.G.klassen.indexOf(k) + 1 }])
    .then(function (uit) {
      var g = uit[0];
      KBSYNC.koppel(k.id, g.id);
      return KBSYNC.duw(k.id, g.id, schoolId);
    })
    .then(haalMensen)
    .then(function () { teken(); meld(k.naam + ' staat nu op de server'); })
    .catch(function (e) { meld('Dat lukte niet: ' + (e && e.message || 'onbekende fout')); });
}

/* ── wat we van de server weten ───────────────────────────────────────
   Wie er op deze school werken, wie bij welke groep mag, en welke
   uitnodigingen nog open staan. Wordt bij het openen opgehaald en na elke
   wijziging bijgewerkt. */

var alleCollegas      = [];
var perProfiel        = {};
var ledenVanGroep     = {};
var openUitnodigingen = [];
var naamVanGroep      = {};

function metServer(){
  return !!(window.KBV && window.SB && window.KBSYNC && SB.ingelogd() &&
            KBV.wie() && KBV.wie().profiel);
}

function haalMensen(){
  if (!metServer()) return Promise.resolve();
  return Promise.all([
    KBV.collegas(),
    KBV.ledenPerGroep(),
    // alleen wat nog openstaat: een verzilverde uitnodiging is een account
    SB.lees('uitnodigingen', { kies:'id,email,rol,groep_id',
                               waar:{ verzilverd:'is.null' }, volgorde:'email' })
      .catch(function () { return []; })
  ]).then(function (uit) {
    alleCollegas = uit[0] || [];
    perProfiel = {};
    alleCollegas.forEach(function (p) { perProfiel[p.id] = p; });
    ledenVanGroep = uit[1] || {};
    openUitnodigingen = uit[2] || [];
    naamVanGroep = {};
    (KB.G.klassen || []).forEach(function (k) {
      var sid = KBSYNC.opServer(k.id);
      if (sid) naamVanGroep[sid] = k.naam;
    });
  }, function () { /* zonder verbinding tonen we het gewoon niet */ });
}

/* ── de schil ─────────────────────────────────────────────────────────
   Dezelfde vorm als het groepsbeheer: een zijbalk met onderdelen en de
   inhoud ernaast. Zo voelt het als één omgeving en niet als twee losse
   programma's. */

var ONDERDELEN = [
  { id:'groepen',  naam:'Groepen',  icoon:'M3 6h7v7H3zM14 6h7v7h-7zM3 15h7v6H3zM14 15h7v6h-7z' },
  { id:'accounts', naam:'Accounts', icoon:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6M22 20v-2a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8' },
  { id:'school',   naam:'De school', icoon:'M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5' }
];
var huidig = 'groepen';

function tekenMenu(){
  var vak = leeg($('zij-menu'));
  ONDERDELEN.forEach(function (o) {
    var b = el('button', 'zij-knop' + (o.id === huidig ? ' aan' : ''));
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '17'); svg.setAttribute('height', '17');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    var pad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pad.setAttribute('d', o.icoon);
    svg.appendChild(pad);
    b.appendChild(svg);
    b.appendChild(el('span', null, o.naam));
    b.addEventListener('click', function () { huidig = o.id; tekenMenu(); teken(); });
    vak.appendChild(b);
  });

  var wie = metServer() ? KBV.wie() : null;
  $('zij-school').textContent = (wie && wie.school && wie.school.naam) || 'Schoolbeheer';

  // het naamplaatje onderin, net als bij het groepsbeheer
  var onder = $('zij-onder');
  var oud = onder.querySelector('.account');
  if (oud) oud.parentNode.removeChild(oud);
  if (metServer()) {
    var plaat = KBV.maakAccountknop({ klasse:'omhoog' });
    if (plaat) onder.insertBefore(plaat, onder.firstChild);
  }
}

function kopregel(titel, onder, rechts){
  var kop = el('div', 'kopregel');
  var links = el('div');
  links.appendChild(el('div', 'titel', titel));
  if (onder) links.appendChild(el('div', 'ondertitel', onder));
  kop.appendChild(links);
  if (rechts) {
    var r = el('div', 'knoprij');
    [].concat(rechts).forEach(function (x) { r.appendChild(x); });
    kop.appendChild(r);
  }
  return kop;
}

function teken(){
  var v = leeg($('inhoud'));
  if (huidig === 'accounts') return tekenAccounts(v);
  if (huidig === 'school')   return tekenSchool(v);
  return tekenGroepen(v);
}

/* ── groepen ─────────────────────────────────────────────────────────── */

function tekenGroepen(v){
  var beheerd = KB.beheerKlasId();
  var klassen = KB.G.klassen || [];

  var opServer = klassen.filter(function (k) { return !metServer() || KBSYNC.opServer(k.id); });
  var alleenHier = metServer()
    ? klassen.filter(function (k) { return !KBSYNC.opServer(k.id); }) : [];

  // De app maakt bij een lege start altijd één groep aan zodat er iets te
  // tonen valt. Die telt hier niet mee.
  var nogLeeg = !opServer.length || (opServer.length === 1 &&
    !(opServer[0].leerlingen || []).length && !(opServer[0].hoekLib || []).length);

  v.appendChild(kopregel('Groepen',
    nogLeeg ? 'Nog niet ingericht'
            : opServer.length + ' groepen · dit apparaat toont ' +
              (beheerd && KB.klas(beheerd) ? KB.klas(beheerd).naam : 'nog geen groep')));

  if (nogLeeg) {
    var leegP = el('div', 'paneel');
    var vak = el('div', 'leegvak');
    vak.appendChild(el('p', 'hint',
      'De school is nog niet ingericht. Zet de zes kleutergroepen in één keer neer — ' +
      '1A, 1B, 1C, 2A, 2B en 2C, elk met de standaardhoeken en een werkplaats.'));
    var rij0 = el('div', 'knoprij-onder');
    rij0.style.justifyContent = 'center';
    rij0.appendChild(knop('Zes groepen aanmaken', 'primair', function () {
      maakSchoolgroepen(false).then(function () { teken(); meld('Zes groepen klaargezet'); },
        function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    rij0.appendChild(knop('Met testkinderen in 1A', 'stil', function () {
      maakSchoolgroepen(true).then(function () { teken(); meld('Zes groepen klaargezet, 1A gevuld'); },
        function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    vak.appendChild(rij0);
    leegP.appendChild(vak);
    v.appendChild(leegP);
    if (!alleenHier.length) return;
  }

  if (!nogLeeg) {
    var rooster = el('div', 'groepen');
    opServer.forEach(function (k) { rooster.appendChild(groepKaart(k, beheerd)); });
    v.appendChild(rooster);
  }

  // Groepen die alleen in deze browser staan. Vaak van vóór het inloggen.
  if (alleenHier.length) {
    var p = el('div', 'paneel');
    p.appendChild(el('div', 'paneelkop', 'Staat alleen op dit apparaat'));
    p.appendChild(el('p', 'hint',
      'Deze groepen zijn ooit hier gemaakt en staan nog niet op de server. Daardoor ' +
      'kan niemand anders erbij en kun je er geen leerkracht aan hangen. Breng ze ' +
      'naar de server, of gooi ze weg als je ze niet meer nodig hebt.'));
    alleenHier.forEach(function (k) {
      var rij = el('div', 'ledenrij wacht');
      var links = el('div');
      links.appendChild(el('div', 'ledennaam', k.naam));
      links.appendChild(el('div', 'ledenmail',
        (k.leerlingen || []).length + ' kinderen · ' + (k.hoekLib || []).length + ' hoeken'));
      rij.appendChild(links);
      var knoppen = el('div', 'knoprij');
      knoppen.appendChild(knop('Naar de server', 'primair', function () { brengNaarServer(k); }));
      knoppen.appendChild(knop('Weggooien', 'gevaar', function () {
        vraagBevestiging('Weggooien?',
          k.naam + ' verdwijnt van dit apparaat, met kinderen, planning en observaties. ' +
          'Dit kan niet terug.', 'Weggooien', function () {
            KB.G.klassen = KB.G.klassen.filter(function (x) { return x.id !== k.id; });
            bewaar(); teken(); meld(k.naam + ' weggegooid');
          });
      }));
      rij.appendChild(knoppen);
      p.appendChild(rij);
    });
    v.appendChild(p);
  }
}

/* ── accounts ────────────────────────────────────────────────────────── */

function tekenAccounts(v){
  if (!metServer()) {
    v.appendChild(kopregel('Accounts', 'Alleen met een server'));
    var p0 = el('div', 'paneel');
    p0.appendChild(el('p', 'hint',
      'Dit apparaat is niet met de server verbonden, dus er zijn geen accounts om ' +
      'te tonen. Log in om collega\'s uit te nodigen.'));
    v.appendChild(p0);
    return;
  }
  v.appendChild(kopregel('Accounts',
    'Wie mag er bij welke groep', knop('Iemand uitnodigen', 'primair', function () { toonUitnodigen(); })));
  v.appendChild(mensenPaneel());
}

/* ── de school ───────────────────────────────────────────────────────── */

function tekenSchool(v){
  v.appendChild(kopregel('De school', metServer() && KBV.wie().school
    ? KBV.wie().school.naam : 'Instellingen voor de hele school'));

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Hoe dit werkt'));
  uitleg.appendChild(el('p', 'hint',
    'Wie waar bij mag regel je bij Accounts, of met "Leerkrachten" op een groepskaart. ' +
    'Een leerkracht ziet alleen de groepen die aan haar zijn toegewezen. Een groep mag ' +
    'meer dan één leerkracht hebben, en een leerkracht meer dan één groep — handig bij ' +
    'een duobaan of een invaller.'));
  uitleg.appendChild(el('p', 'hint',
    'Jij als schoolbeheerder mag overal bij: met "Beheer openen" en "Bord openen" ga je ' +
    'naar elke groep, ook die niet van jou zijn.'));
  uitleg.appendChild(el('p', 'hint',
    '"Dit apparaat hierop zetten" is voor het digibord in een lokaal: dat onthoudt welke ' +
    'groep het bij het opstarten laat zien, zodat er \u2019s ochtends niemand hoeft te kiezen.'));
  v.appendChild(uitleg);

  var opnieuw = el('div', 'paneel');
  opnieuw.appendChild(el('div', 'paneelkop', 'Opnieuw beginnen'));
  opnieuw.appendChild(el('p', 'hint',
    'Zet de zes kleutergroepen opnieuw neer: 1A, 1B, 1C, 2A, 2B en 2C, elk met de ' +
    'standaardhoeken en een werkplaats. Alle bestaande groepen en hun gegevens verdwijnen — ' +
    'kinderen, planning, doelen en observaties, ook op de server en bij je collega\'s.'));
  var rij = el('div', 'knoprij-onder');
  rij.appendChild(knop('Zes lege groepen', 'gevaar', function () {
    vraagBevestiging('Alles vervangen door zes lege groepen?',
      'Elke bestaande groep verdwijnt, met kinderen, planning en observaties. Dit kan niet terug.',
      'Vervangen', function () {
        maakSchoolgroepen(false).then(function () {
          huidig = 'groepen'; tekenMenu(); teken(); meld('Zes lege groepen klaargezet');
        }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
      });
  }));
  rij.appendChild(knop('Zes groepen, 1A met testkinderen', 'gevaar', function () {
    vraagBevestiging('Alles vervangen?',
      'Zes groepen, waarbij 1A ' + TESTKINDEREN.length + ' verzonnen kinderen krijgt om mee te ' +
      'proeven. Alle bestaande groepen verdwijnen.',
      'Vervangen', function () {
        maakSchoolgroepen(true).then(function () {
          huidig = 'groepen'; tekenMenu(); teken(); meld('Zes groepen klaargezet, 1A gevuld');
        }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
      });
  }));
  opnieuw.appendChild(rij);
  v.appendChild(opnieuw);
}

function groepKaart(k, beheerd){
  var kaart = el('div', 'groepkaart' + (k.id === beheerd ? ' dit' : ''));
  var code = codeVan(k);
  kaart.style.setProperty('--groepkleur', GROEPKLEUREN[code] || '#8a94a6');

  var kop = el('div', 'groepkop');
  kop.appendChild(el('div', 'groepkaart-naam', k.naam));
  if (k.id === beheerd) kop.appendChild(el('span', 'ditlabel', 'dit apparaat'));
  kaart.appendChild(kop);

  var kinderen = (k.leerlingen || []).filter(function (l) { return l.lid !== false; });
  var ws = KB.weekSleutel();
  var w = (k.weken && k.weken[ws]) ? k.weken[ws] : { taken: [] };
  var aanDeBeurt = {};
  (w.taken || []).forEach(function (wt) {
    KB.toegewezen(wt).forEach(function (id) { aanDeBeurt[id] = true; });
  });
  var metBeurt = Object.keys(aanDeBeurt).length;

  var cijfers = el('div', 'cijfers');
  [[kinderen.length, 'kinderen'],
   [(k.hoekLib || []).length, 'hoeken'],
   [(w.taken || []).length, 'taken deze week']
  ].forEach(function (paar) {
    var c = el('div', 'cijfer');
    c.appendChild(el('div', 'n', String(paar[0])));
    c.appendChild(el('div', 'l', paar[1]));
    cijfers.appendChild(c);
  });
  kaart.appendChild(cijfers);

  if (kinderen.length && (w.taken || []).length) {
    var deel = Math.round((metBeurt / kinderen.length) * 100);
    var balk = el('div', 'groepbalkje');
    var vulling = el('span');
    vulling.style.width = deel + '%';
    if (deel < 100) vulling.style.background = 'var(--let-op)';
    balk.appendChild(vulling);
    kaart.appendChild(balk);
    kaart.appendChild(el('div', 'beurtregel',
      metBeurt + ' van de ' + kinderen.length + ' kinderen zijn deze week aan de beurt'));
  } else if (!kinderen.length) {
    kaart.appendChild(el('div', 'beurtregel', 'Nog geen kinderen ingevoerd'));
  } else {
    kaart.appendChild(el('div', 'beurtregel', 'Nog geen taak ingepland deze week'));
  }

  // Wie mag er bij deze groep. Een schoolbeheerder mag overal bij en staat
  // er daarom niet apart bij -- die zou anders bij elke groep staan.
  if (metServer()) {
    var eigen = (ledenVanGroep[KBSYNC.opServer(k.id)] || [])
      .map(function (id) { return (perProfiel[id] || {}).naam ||
                                  (perProfiel[id] || {}).email || 'onbekend'; });
    kaart.appendChild(el('div', 'beurtregel',
      eigen.length ? 'Leerkracht: ' + eigen.join(', ')
                   : 'Nog geen leerkracht toegewezen'));
  }

  var acties = el('div', 'groepacties');
  acties.appendChild(knop('Beheer openen', 'primair', function () {
    ganaarGroep(k, 'beheer.html');
  }));
  /* Het bord ligt in Planbord niet hiernaast maar in de andere app;
     KB.bordAdres weet dat, en zet de groep in het adres. */
  acties.appendChild(knop('Bord openen', 'stil', function () {
    ganaarGroep(k, KB.bordAdres(k.id));
  }));
  if (metServer()) {
    acties.appendChild(knop('Leerkrachten', 'stil', function () { toonLeden(k); }));
  }
  if (k.id !== beheerd) {
    acties.appendChild(knop('Dit apparaat hierop zetten', 'stil', function () {
      KB.zetBeheerKlas(k.id); bewaar(); teken();
      meld('Dit apparaat beheert nu ' + k.naam);
    }));
  }
  kaart.appendChild(acties);
  return kaart;
}

/* ── van groep wisselen ───────────────────────────────────────────────
   Als beheerder mag je bij elke groep. Voor je naar het beheer of het
   bord gaat halen we die groep eerst binnen, anders kijk je naar wat er
   toevallig nog in deze browser stond. */

function ganaarGroep(k, pagina){
  if (!metServer()) { KB.zetBeheerKlas(k.id); bewaar(); gaNaar(pagina); return; }
  meld('Bezig met ' + k.naam + ' ophalen…');
  KBV.naarGroep(k.id).then(function () {
    gaNaar(pagina);
  }, function (e) {
    if (e && e.offline) { KB.zetBeheerKlas(k.id); bewaar(); gaNaar(pagina); return; }
    meld('Dat lukte niet: ' + (e && e.message || 'onbekende fout'));
  });
}

/* ── leerkrachten aan een groep hangen ───────────────────────────────── */

function toonLeden(k){
  var serverId = KBSYNC.opServer(k.id);
  toonBlad(function (blad) {
    blad.appendChild(el('h3', 'titel', 'Wie mag bij ' + k.naam + '?'));
    blad.appendChild(el('p', 'hint',
      'Een groep mag meer dan één leerkracht hebben, en een leerkracht mag meer dan ' +
      'één groep hebben. Schoolbeheerders staan er niet bij: die mogen overal bij.'));

    var lijst = el('div', 'ledenlijst');
    var leerkrachten = alleCollegas.filter(function (p) { return p.rol === 'leerkracht'; });
    if (!leerkrachten.length) {
      lijst.appendChild(el('p', 'hint',
        'Er zijn nog geen leerkrachten. Nodig ze uit met hun e-mailadres; ' +
        'zodra ze een account maken staan ze hier.'));
    }
    leerkrachten.forEach(function (p) {
      var aan = (ledenVanGroep[serverId] || []).indexOf(p.id) >= 0;
      var rij = el('div', 'ledenrij' + (aan ? ' aan' : ''));
      var links = el('div');
      links.appendChild(el('div', 'ledennaam', p.naam || p.email));
      if (p.naam) links.appendChild(el('div', 'ledenmail', p.email));
      rij.appendChild(links);
      rij.appendChild(knop(aan ? 'Weghalen' : 'Toewijzen', aan ? 'gevaar' : 'primair',
        function () {
          var werk = aan ? KBV.ontkoppelVanGroep(serverId, p.id)
                         : KBV.koppelAanGroep(serverId, p.id);
          werk.then(function () {
            return KBV.ledenPerGroep();
          }).then(function (nieuw) {
            ledenVanGroep = nieuw;
            sluitBlad(); teken(); toonLeden(k);
            meld(aan ? (p.naam || p.email) + ' is weggehaald bij ' + k.naam
                     : (p.naam || p.email) + ' hoort nu bij ' + k.naam);
          }, function (e) {
            meld('Dat lukte niet: ' + (e && e.message || 'onbekende fout'));
          });
        }));
      lijst.appendChild(rij);
    });
    blad.appendChild(lijst);

    var rij2 = el('div', 'knoprij-onder');
    rij2.appendChild(knop('Klaar', 'stil', sluitBlad));
    blad.appendChild(rij2);
  });
}

/* Andersom gezien: welke groepen heeft elke leerkracht? Handig om in één
   oogopslag te zien wie er nog nergens bij hoort. */
function mensenPaneel(){
  var p = el('div', 'paneel');
  var kop = el('div', 'kopregel');
  kop.appendChild(el('div', 'paneelkop', 'Accounts'));
  var kopknoppen = el('div', 'knoprij');
  kopknoppen.appendChild(knop('Iemand uitnodigen', 'primair', function () { toonUitnodigen(); }));
  kop.appendChild(kopknoppen);
  p.appendChild(kop);
  p.appendChild(el('p', 'hint',
    'Een account maak je niet hier, maar door iemand uit te nodigen op haar ' +
    'e-mailadres. Zodra zij naar de site gaat en op "Er een maken" klikt met datzelfde ' +
    'adres, staat ze meteen bij de goede school en groep.'));

  var leerkrachten = alleCollegas.filter(function (x) { return x.rol === 'leerkracht'; });
  if (!leerkrachten.length) {
    p.appendChild(el('p', 'hint',
      'Er zijn nog geen leerkrachten met een account. Nodig ze uit met hun ' +
      'e-mailadres; zodra ze zich aanmelden staan ze hier en kun je ze aan een ' +
      'groep hangen.'));
    return p;
  }

  leerkrachten.forEach(function (mens) {
    var groepen = [];
    Object.keys(ledenVanGroep).forEach(function (gid) {
      if (ledenVanGroep[gid].indexOf(mens.id) >= 0 && naamVanGroep[gid]) {
        groepen.push(naamVanGroep[gid]);
      }
    });
    var rij = el('div', 'ledenrij');
    var links = el('div');
    links.appendChild(el('div', 'ledennaam', mens.naam || mens.email));
    links.appendChild(el('div', 'ledenmail',
      groepen.length ? groepen.sort().join(', ') : 'nog geen groep'));
    rij.appendChild(links);
    p.appendChild(rij);
  });

  var beheerders = alleCollegas.filter(function (x) { return x.rol === 'schoolbeheerder'; });
  beheerders.forEach(function (mens) {
    var rij = el('div', 'ledenrij');
    var links = el('div');
    links.appendChild(el('div', 'ledennaam', mens.naam || mens.email));
    links.appendChild(el('div', 'ledenmail', 'schoolbeheerder — mag bij alle groepen'));
    rij.appendChild(links);
    p.appendChild(rij);
  });

  if (openUitnodigingen.length) {
    p.appendChild(el('div', 'restvak-kop', 'Nog niet aangemeld'));
    openUitnodigingen.forEach(function (u) {
      var rij = el('div', 'ledenrij wacht');
      var links = el('div');
      links.appendChild(el('div', 'ledennaam', u.email));
      links.appendChild(el('div', 'ledenmail',
        (u.rol === 'schoolbeheerder' ? 'schoolbeheerder' : 'leerkracht') +
        (u.groep_id && naamVanGroep[u.groep_id] ? ' · ' + naamVanGroep[u.groep_id] : '') +
        ' — wacht tot zij een account maakt'));
      rij.appendChild(links);
      rij.appendChild(knop('Intrekken', 'gevaar', function () {
        SB.wis('uitnodigingen', { id:'eq.' + u.id }).then(haalMensen).then(function () {
          teken(); meld('Uitnodiging voor ' + u.email + ' ingetrokken');
        }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
      }));
      p.appendChild(rij);
    });
  }
  return p;
}

/* ── iemand uitnodigen ────────────────────────────────────────────────
   Een account aanmaken kan alleen de persoon zelf, met haar eigen
   wachtwoord. Wat wij hier doen is de plek klaarzetten: e-mailadres, rol
   en eventueel een groep. Zodra zij zich aanmeldt valt alles op zijn
   plaats. */

function toonUitnodigen(concept){
  concept = concept || { email:'', rol:'leerkracht', groepId:'' };
  toonBlad(function (blad) {
    blad.appendChild(el('h3', 'titel', 'Iemand uitnodigen'));
    blad.appendChild(el('p', 'hint',
      'Vul het e-mailadres in waarmee zij een account gaat maken. Ze krijgt van ons ' +
      'geen mailtje — geef haar zelf even het adres van de site door.'));

    var veld = el('div', 'veldrij');
    veld.appendChild(el('label', 'veldlabel', 'E-mailadres'));
    var invoer = el('input', 'invoer');
    invoer.type = 'email'; invoer.placeholder = 'juf.marieke@school.nl';
    invoer.autocapitalize = 'off'; invoer.spellcheck = false;
    invoer.value = concept.email;
    invoer.addEventListener('input', function () { concept.email = invoer.value; });
    veld.appendChild(invoer);
    blad.appendChild(veld);

    var rolrij = el('div', 'veldrij');
    rolrij.appendChild(el('label', 'veldlabel', 'Wat mag zij?'));
    var chips = el('div', 'knoprij');
    [['leerkracht', 'Leerkracht — alleen haar eigen groepen'],
     ['schoolbeheerder', 'Schoolbeheerder — alles']].forEach(function (paar) {
      var c = el('button', 'chip' + (concept.rol === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        concept.rol = paar[0]; sluitBlad(); toonUitnodigen(concept);
      });
      chips.appendChild(c);
    });
    rolrij.appendChild(chips);
    blad.appendChild(rolrij);

    if (concept.rol === 'leerkracht') {
      var grij = el('div', 'veldrij');
      grij.appendChild(el('label', 'veldlabel', 'Meteen bij welke groep? (mag ook later)'));
      var gchips = el('div', 'knoprij');
      var geen = el('button', 'chip' + (concept.groepId ? '' : ' aan'), 'Nog geen');
      geen.addEventListener('click', function () {
        concept.groepId = ''; sluitBlad(); toonUitnodigen(concept);
      });
      gchips.appendChild(geen);
      KB.G.klassen.forEach(function (k) {
        var sid = KBSYNC.opServer(k.id);
        if (!sid) return;
        var c = el('button', 'chip' + (concept.groepId === sid ? ' aan' : ''), k.naam);
        c.addEventListener('click', function () {
          concept.groepId = sid; sluitBlad(); toonUitnodigen(concept);
        });
        gchips.appendChild(c);
      });
      grij.appendChild(gchips);
      blad.appendChild(grij);
    }

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Uitnodigen', 'primair', function () {
      var email = (concept.email || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        meld('Dat lijkt geen geldig e-mailadres'); return;
      }
      var rijGegevens = { school_id: KBV.wie().profiel.school_id, email: email, rol: concept.rol };
      if (concept.rol === 'leerkracht' && concept.groepId) rijGegevens.groep_id = concept.groepId;
      SB.schrijf('uitnodigingen', [rijGegevens]).then(haalMensen).then(function () {
        sluitBlad(); teken();
        meld(email + ' is uitgenodigd. Geef haar het adres van de site door.');
      }, function (e) {
        meld(/duplicate|unique/i.test(e && e.message || '')
          ? 'Voor dat adres staat al een uitnodiging klaar.'
          : 'Dat lukte niet: ' + (e && e.message));
      });
    }));
    blad.appendChild(rij);
    setTimeout(function () { invoer.focus(); }, 60);
  });
}



KB.laad();
KB.doelenZorg()
  .then(function () { return window.KBV ? KBV.zodraKlaar() : Promise.resolve({ lokaal:true }); })
  .then(haalMensen)
  .then(function () { return KB.fkLees(); })
  .then(function (m) { if (m) KB.fkPasToe(m); })
  .catch(function () {})
  .then(function () { tekenMenu(); teken(); });

})();
