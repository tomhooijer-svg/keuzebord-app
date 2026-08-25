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

function maakSchoolgroepen(metTestkinderen){
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
  // Dit apparaat begint bij de eerste groep.
  KB.zetBeheerKlas(KB.G.klassen[0].id);
  bewaar();
}

/* ── tekenen ─────────────────────────────────────────────── */
/* Wat we van de server weten over wie waar bij mag. Wordt bij het openen
   opgehaald en na elke wijziging bijgewerkt. */
var alleCollegas  = [];
var perProfiel    = {};
var ledenVanGroep = {};

function metServer(){
  return !!(window.KBV && window.SB && window.KBSYNC && SB.ingelogd());
}

function haalMensen(){
  if (!metServer()) return Promise.resolve();
  return Promise.all([KBV.collegas(), KBV.ledenPerGroep()]).then(function (uit) {
    alleCollegas = uit[0] || [];
    perProfiel = {};
    alleCollegas.forEach(function (p) { perProfiel[p.id] = p; });
    ledenVanGroep = uit[1] || {};
  }, function () { /* zonder verbinding tonen we het gewoon niet */ });
}

function teken(){
  var v = leeg($('school-inhoud'));
  var acties = leeg($('school-acties'));
  var beheerd = KB.beheerKlasId();

  acties.appendChild((function () {
    var a = el('a', 'knop knop-stil knop-klein', 'Naar het bord');
    a.href = 'bord.html'; return a;
  })());
  acties.appendChild((function () {
    var a = el('a', 'knop knop-primair knop-klein', 'Naar het groepsbeheer');
    a.href = 'beheer.html'; return a;
  })());

  var klassen = KB.G.klassen;

  // De app maakt bij een lege start altijd één groep aan zodat er iets
  // te tonen valt. Die telt hier niet mee: zolang er niemand in zit en er
  // geen hoeken zijn, is de school nog niet ingericht.
  var nogLeeg = !klassen.length || (klassen.length === 1 &&
    !(klassen[0].leerlingen || []).length && !(klassen[0].hoekLib || []).length);

  $('school-sub').textContent = nogLeeg
    ? 'Nog niet ingericht'
    : klassen.length + ' groepen · dit apparaat beheert ' +
      (beheerd ? KB.klas(beheerd).naam : 'nog geen groep');

  if (nogLeeg) {
    var leegP = el('div', 'paneel');
    var vak = el('div', 'leegvak');
    vak.appendChild(el('p', 'hint',
      'De school is nog niet ingericht. Zet de zes kleutergroepen in één keer neer — ' +
      '1A, 1B, 1C, 2A, 2B en 2C, elk met de standaardhoeken en een werkplaats.'));
    var rij0 = el('div', 'knoprij-onder');
    rij0.style.justifyContent = 'center';
    rij0.appendChild(knop('Zes groepen aanmaken', 'primair', function () {
      maakSchoolgroepen(false); teken(); meld('Zes groepen klaargezet');
    }));
    rij0.appendChild(knop('Met testkinderen in 1A', 'stil', function () {
      maakSchoolgroepen(true); teken(); meld('Zes groepen klaargezet, 1A gevuld');
    }));
    vak.appendChild(rij0);
    leegP.appendChild(vak);
    v.appendChild(leegP);
    return;
  }

  var rooster = el('div', 'groepen');
  klassen.forEach(function (k) {
    rooster.appendChild(groepKaart(k, beheerd));
  });
  v.appendChild(rooster);

  if (metServer()) v.appendChild(mensenPaneel());

  var opnieuw = el('div', 'paneel');
  opnieuw.appendChild(el('div', 'paneelkop', 'Opnieuw beginnen'));
  opnieuw.appendChild(el('p', 'hint',
    'Zet de zes kleutergroepen opnieuw neer: 1A, 1B, 1C, 2A, 2B en 2C, elk met de ' +
    'standaardhoeken en een werkplaats. Alle bestaande groepen en hun gegevens verdwijnen — ' +
    'kinderen, planning, doelen en observaties.'));
  var rij = el('div', 'knoprij-onder');
  rij.appendChild(knop('Zes lege groepen', 'gevaar', function () {
    vraagBevestiging('Alles vervangen door zes lege groepen?',
      'Elke bestaande groep verdwijnt, met kinderen, planning en observaties. Dit kan niet terug.',
      'Vervangen', function () { maakSchoolgroepen(false); teken(); meld('Zes lege groepen klaargezet'); });
  }));
  rij.appendChild(knop('Zes groepen, 1A met testkinderen', 'gevaar', function () {
    vraagBevestiging('Alles vervangen?',
      'Zes groepen, waarbij 1A ' + TESTKINDEREN.length + ' verzonnen kinderen krijgt om mee te proeven. ' +
      'Alle bestaande groepen verdwijnen.',
      'Vervangen', function () { maakSchoolgroepen(true); teken(); meld('Zes groepen klaargezet, 1A gevuld'); });
  }));
  opnieuw.appendChild(rij);
  v.appendChild(opnieuw);

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Hoe dit werkt'));
  uitleg.appendChild(el('p', 'hint',
    'Wie waar bij mag regel je met "Leerkrachten" op een groepskaart. Een leerkracht ziet ' +
    'alleen de groepen die aan haar zijn toegewezen en kan niet per ongeluk in een andere ' +
    'groep terechtkomen. Een groep mag meer dan één leerkracht hebben, en een leerkracht ' +
    'meer dan één groep — handig bij een duobaan of een invaller.'));
  uitleg.appendChild(el('p', 'hint',
    'Jij als schoolbeheerder mag overal bij: met "Beheer openen" en "Bord openen" ga je naar ' +
    'elke groep, ook de groepen die niet van jou zijn.'));
  uitleg.appendChild(el('p', 'hint',
    '"Dit apparaat hierop zetten" is voor het digibord in een lokaal: dat onthoudt welke groep ' +
    'het bij het opstarten laat zien, zodat er \u2019s ochtends niemand hoeft te kiezen. ' +
    'Deze pagina is voor jou als beheerder — die hoef je niet met iedereen te delen.'));
  v.appendChild(uitleg);
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
  acties.appendChild(knop('Bord openen', 'stil', function () {
    ganaarGroep(k, 'bord.html');
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
  p.appendChild(el('div', 'paneelkop', 'Leerkrachten'));

  var naamVanGroep = {};
  KB.G.klassen.forEach(function (k) {
    var sid = KBSYNC.opServer(k.id);
    if (sid) naamVanGroep[sid] = k.naam;
  });

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
  if (beheerders.length) {
    p.appendChild(el('p', 'hint',
      'Schoolbeheerder: ' + beheerders.map(function (x) { return x.naam || x.email; }).join(', ') +
      ' — die mag bij alle groepen.'));
  }
  return p;
}

KB.laad();
KB.doelenLaad();
(window.KBV ? KBV.zodraKlaar() : Promise.resolve({ lokaal:true }))
  .then(haalMensen)
  .then(function () { return KB.fkLees(); })
  .then(function (m) { if (m) KB.fkPasToe(m); })
  .catch(function () {})
  .then(teken);

})();
