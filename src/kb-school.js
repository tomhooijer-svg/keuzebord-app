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
/* De cursor in het eerste veld zetten, maar alleen als er nog niemand
   zelf ergens op heeft geklikt. Het wachten is voor de animatie van het
   blad; wie binnen die tijd al begint te typen zou anders zijn eerste
   tekens in het verkeerde vak zien belanden. Dat is zeldzaam voor een
   mens en gegarandeerd voor een proef, en het is allebei fout. */
function zetCursor(veld, blad){
  setTimeout(function () {
    var nu = document.activeElement;
    if (nu && nu !== document.body && blad && blad.contains(nu)) return;
    veld.focus();
  }, 60);
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

/* Een bestandskiezer die eruitziet als een knop. Staat ook in
   kb-beheer.js; die twee schermen delen geen code, want ze zijn
   allebei een eigen eilandje met een eigen venster en eigen
   meldingen. Let op de vorm van bijKeuze: zonder meervoud krijg je
   één bestand, niet een lijst van één. */
function bestandKnop(tekst, accept, meervoud, bijKeuze, soort){
  var label = el('label', 'knop knop-' + (soort || 'stil') + ' knop-klein uploadvak', tekst);
  var inv = el('input');
  inv.type = 'file'; inv.accept = accept; inv.multiple = !!meervoud; inv.style.display = 'none';
  inv.addEventListener('change', function () {
    var lijst = Array.prototype.slice.call(inv.files);
    inv.value = '';
    if (lijst.length) bijKeuze(meervoud ? lijst : lijst[0]);
  });
  label.appendChild(inv);
  return label;
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

/* Een code die je door de telefoon kunt doorgeven. Geen i, l, o, 0 of 1
   erin: die haalt iedereen door elkaar. Acht tekens uit tweeëndertig is
   ruim een biljoen mogelijkheden, dus raden heeft geen zin -- en hij
   vervalt vanzelf na drie weken. */
var CODETEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function nieuweCode(){
  var uit = '';
  var ruw = new Uint8Array(8);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(ruw);
  else for (var j = 0; j < 8; j++) ruw[j] = Math.floor(Math.random() * 256);
  for (var i = 0; i < 8; i++) uit += CODETEKENS.charAt(ruw[i] % CODETEKENS.length);
  return uit;
}
function codeLeesbaar(code){
  return code ? String(code).slice(0, 4) + '-' + String(code).slice(4) : '';
}

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
var openVerzoeken     = [];
var groepenOpServer   = null;   // null = niet gevraagd
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
    /* Alleen wat nog echt openstaat. Een uitnodiging is binnen als iemand
       zich met dat adres aanmeldde (verzilverd) óf als de code is gebruikt;
       oudere uitnodigingen hebben helemaal geen code, dus we kijken naar
       allebei. */
    SB.lees('uitnodigingen', { kies:'id,email,rol,groep_id,code',
                               waar:{ verzilverd:'is.null', code_gebruikt:'is.null' },
                               volgorde:'email' })
      .catch(function () { return []; }),
    // wie er toegang tot een groep heeft gevraagd
    SB.lees('groep_verzoeken', { kies:'id,groep_id,profiel_id,reden,aangemaakt',
                                 waar:{ behandeld:'is.null' }, volgorde:'aangemaakt' })
      .catch(function () { return []; }),
    /* Wat er écht op de server staat. Het oordeel "deze school is nog niet
       ingericht" kwam uit wat er toevallig in deze browser stond -- en
       daaronder zit een knop die alle groepen wist en opnieuw begint. Op
       een vers apparaat, of als het ophalen net was mislukt, stond die
       knop er dus terwijl de school gewoon vol was. */
    SB.lees('groepen', { kies:'id' }).catch(function () { return null; })
  ]).then(function (uit) {
    alleCollegas = uit[0] || [];
    perProfiel = {};
    alleCollegas.forEach(function (p) { perProfiel[p.id] = p; });
    ledenVanGroep = uit[1] || {};
    openUitnodigingen = uit[2] || [];
    openVerzoeken = uit[3] || [];
    groepenOpServer = uit[4] ? uit[4].length : null;
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

/* Het logo van de school in de zijbalk, op de plek van het p'tje. Voor
   een juf is haar school belangrijker dan wie de app gemaakt heeft; het
   woordmerk onderin blijft staan, dus er gaat niets verloren.

   Het komt uit wat deze browser onthield, zodat het er meteen staat en
   niet pas als de school is opgehaald. */
function zetSchoollogo(){
  var logo = KB.schoollogo();
  var kop = document.querySelector('.zijbalk .zij-kop');
  if (!kop) return;
  var oud = kop.querySelector('.schoollogo');
  if (!logo) { if (oud) oud.remove(); return; }
  var merk = kop.querySelector('.merkteken');
  if (merk) merk.style.display = 'none';
  if (oud) { oud.src = logo; return; }
  var beeld = document.createElement('img');
  beeld.className = 'schoollogo';
  beeld.src = logo;
  beeld.alt = '';
  kop.insertBefore(beeld, kop.firstChild);
}

function tekenMenu(){
  zetSchoollogo();
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
    b.addEventListener('click', function () {
      huidig = o.id; tekenMenu(); teken();
      if (o.id === 'school') haalDeur().then(teken, function () {});
    });
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

/* ── nog bij geen school ──────────────────────────────────────────────
   Twee wegen: je hoort bij een school die er al is (dan heb je een code
   van de beheerder), of je begint er zelf een. Meer smaken zijn er niet --
   en zonder een van de twee kun je hier niets, want alles hangt aan een
   school. */
function tekenZonderSchool(v){
  v.appendChild(kopregel('Welkom', 'Dit account hoort nog bij geen school'));

  var p1 = el('div', 'paneel');
  p1.appendChild(el('div', 'paneelkop', 'Ik ben uitgenodigd'));
  p1.appendChild(el('p', 'hint',
    'Je schoolbeheerder heeft een code voor je. Vul die hieronder in, dan kom je ' +
    'bij de goede school en groep terecht. Werkt hij niet meer, vraag dan een ' +
    'nieuwe — een code geldt drie weken en werkt één keer.'));
  var rij = el('div', 'veldrij');
  var invoer = el('input', 'invoer');
  invoer.type = 'text'; invoer.placeholder = 'ABCD-2345';
  invoer.autocapitalize = 'characters'; invoer.spellcheck = false;
  rij.appendChild(invoer);
  p1.appendChild(rij);
  var knopRij = el('div', 'knoprij-onder');
  knopRij.appendChild(knop('Aanmelden bij de school', 'primair', function () {
    var code = (invoer.value || '').replace(/[^A-Za-z0-9]/g, '');
    if (code.length < 4) { meld('Vul de code in die je van je schoolbeheerder kreeg'); return; }
    meld('Bezig…');
    SB.roep('uitnodiging_verzilveren', { toegangscode: code })
      .then(function () { return KBV.herstart(); })
      .then(function () { location.href = 'school.html'; },
            function (e) { meld(e && e.message ? e.message : 'Dat lukte niet'); });
  }));
  p1.appendChild(knopRij);
  v.appendChild(p1);

  var p2 = el('div', 'paneel');
  p2.appendChild(el('div', 'paneelkop', 'Ik begin een nieuwe school'));
  p2.appendChild(el('p', 'hint',
    'Hoort er nog geen school bij dit account en ben jij degene die hem opzet? ' +
    'Dan word je de schoolbeheerder: jij nodigt de collega\u2019s uit en bepaalt ' +
    'wie bij welke groep mag.'));
  var rij2 = el('div', 'veldrij');
  var naamVak = el('input', 'invoer');
  naamVak.type = 'text'; naamVak.placeholder = 'De naam van je school';
  rij2.appendChild(naamVak);
  p2.appendChild(rij2);
  var knopRij2 = el('div', 'knoprij-onder');
  knopRij2.appendChild(knop('School beginnen', 'stil', function () {
    var naam = (naamVak.value || '').trim();
    if (naam.length < 2) { meld('Geef de school een naam'); return; }
    meld('Bezig…');
    SB.roep('school_beginnen', { schoolnaam: naam })
      .then(function () { return KBV.herstart(); })
      .then(function () { location.href = 'school.html'; },
            function (e) { meld(e && e.message ? e.message : 'Dat lukte niet'); });
  }));
  p2.appendChild(knopRij2);
  v.appendChild(p2);
}

/* ── groepen ─────────────────────────────────────────────────────────── */

function tekenGroepen(v){
  /* Wie nog bij geen school hoort kwam hier vast te zitten: het enige wat
     er stond was "zes groepen aanmaken", en dat ketst af op de rechten
     omdat er geen school is om ze in te zetten. Nu staan hier de twee
     wegen die er echt zijn. */
  if (metServer() && !KBV.wie().profiel.school_id) { tekenZonderSchool(v); return; }

  var beheerd = KB.beheerKlasId();
  var klassen = KB.G.klassen || [];

  var opServer = klassen.filter(function (k) { return !metServer() || KBSYNC.opServer(k.id); });
  var alleenHier = metServer()
    ? klassen.filter(function (k) { return !KBSYNC.opServer(k.id); }) : [];

  // De app maakt bij een lege start altijd één groep aan zodat er iets te
  // tonen valt. Die telt hier niet mee.
  var nogLeeg = !opServer.length || (opServer.length === 1 &&
    !(opServer[0].leerlingen || []).length && !(opServer[0].hoekLib || []).length);
  /* En de server moet het ook vinden. Deze knop gooit namelijk alle groepen
     weg voordat hij zes nieuwe neerzet -- met de kinderen, weekplannen en
     observaties eraan vast. Weet dit apparaat het even niet, dan hoort hij
     er niet te staan. */
  if (metServer() && groepenOpServer !== 0) nogLeeg = false;

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
    'Wie mag er bij welke groep', knop('Collega toevoegen', 'primair', function () { toonCollegaToevoegen(); })));
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
    'Een leerkracht ziet alleen de groepen die aan hem of haar zijn toegewezen. Een groep mag ' +
    'meer dan één leerkracht hebben, en een leerkracht meer dan één groep — handig bij ' +
    'een duobaan of een invaller.'));
  uitleg.appendChild(el('p', 'hint',
    'Jij als schoolbeheerder mag overal bij: met "Beheer openen" en "Bord openen" ga je ' +
    'naar elke groep, ook die niet van jou zijn.'));
  uitleg.appendChild(el('p', 'hint',
    '"Dit apparaat hierop zetten" is voor het digibord in een lokaal: dat onthoudt welke ' +
    'groep het bij het opstarten laat zien, zodat er \u2019s ochtends niemand hoeft te kiezen.'));
  v.appendChild(uitleg);

  if (metServer()) v.appendChild(schoolnaamPaneel());
  if (metServer()) v.appendChild(huisstijlPaneel());
  if (metServer()) v.appendChild(kindfotoPaneel());
  if (metServer()) v.appendChild(ondersteuningPaneel());
  if (metServer()) v.appendChild(uitdraaiPaneel());
  if (metServer()) v.appendChild(logboekPaneel());

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

/* ── de kleuren van de school ─────────────────────────────────────────
   De app staat in de stijl van Pixelplein. Een school die hem afneemt
   mag daar haar eigen kleuren voor in de plaats zetten -- drie, meer
   niet, en de rest rekent de app eruit (zie KB.huisstijlVariabelen).

   Waarom drie en niet alles: met een volledige kleurenkiezer kan een
   school eindigen met lichtgrijze tekst op wit, en dan is het onze
   fout dat het product niet leesbaar is. Met deze drie kan dat niet:
   de gedimde tekst blijft de inkt met wit erdoor, en de ingedrukte
   knop blijft de knop met zwart erdoor.

   Het botergeel zit er met opzet niet bij. Dat betekent op het bord
   "gekozen" of "aan de beurt" -- een afspraak met de kinderen, geen
   smaakkwestie. */

/* ══════════════════════════════════════════════════════════
   DE SCHOOL ZELF
   Naam, logo en kleuren. Alles wat een school tot háár school
   maakt, op één plek -- want wie het een gaat aanpassen, wil
   meestal het ander ook.
   ══════════════════════════════════════════════════════════ */

function alleenBeheerder(p){
  var wie = KBV.wie();
  if (!wie || wie.profiel.rol !== 'schoolbeheerder') {
    p.appendChild(el('p', 'hint', 'Alleen de schoolbeheerder kan dit aanpassen.'));
    return false;
  }
  return true;
}

/* ── naam en logo ─────────────────────────────────────────────────── */

function schoolnaamPaneel(){
  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'Naam en logo'));
  if (!alleenBeheerder(p)) return p;

  var school = (KBV.wie() && KBV.wie().school) || {};
  p.appendChild(el('p', 'hint',
    'De naam staat op het inlogkaartje van je collega\'s en bovenaan dit scherm. ' +
    'Het logo komt op het inlogscherm en in het menu \u2014 niet op het bord zelf, ' +
    'want daar is elke plek die geen hoek is er een te veel.'));

  var veld = el('div', 'veldrij');
  veld.appendChild(el('label', 'veldlabel', 'Naam van de school'));
  var invoer = el('input', 'invoer');
  invoer.type = 'text'; invoer.value = school.naam || '';
  invoer.placeholder = 'Kindcentrum De Regenboog';
  veld.appendChild(invoer);
  p.appendChild(veld);

  var logovak = el('div', 'logovak');
  var logoBeeld = el('img', 'logovoorbeeld');
  var huidigLogo = school.logo || KB.schoollogo();
  if (huidigLogo) logoBeeld.src = huidigLogo;
  else logoBeeld.style.display = 'none';
  logovak.appendChild(logoBeeld);
  var logouitleg = el('div', 'hint', huidigLogo
    ? 'Dit logo staat nu op het inlogscherm en in het menu.'
    : 'Nog geen logo. Een vierkant of liggend plaatje werkt het beste.');
  logovak.appendChild(logouitleg);
  p.appendChild(logovak);

  var rij = el('div', 'knoprij-onder');
  rij.appendChild(knop('Naam opslaan', 'primair', function () {
    var n = invoer.value.trim();
    if (!n) { meld('Een school heeft een naam nodig'); invoer.focus(); return; }
    SB.wijzig('scholen', { naam: n }, { id:'eq.' + school.id })
      .then(function () { return KBV.herstart(); })
      .then(function () { teken(); meld('Naam opgeslagen'); },
            function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
  }));

  rij.appendChild(bestandKnop('Logo kiezen', 'image/*', false, function (f) {
    if (!f) return;
    meld('Bezig met verkleinen\u2026');
    /* Hard verkleinen. Dit plaatje reist mee in de rij van de school,
       die elke pagina bij het openen ophaalt -- een logo van twee
       megabyte zou elke keer weer over de lijn gaan, ook op een
       telefoon van een juf onderweg. */
    KB.verkleinTekening(f, 256).then(function (data) {
      if (data.length > 60000) {
        meld('Dit logo blijft te zwaar. Probeer een eenvoudiger plaatje.');
        return;
      }
      return SB.wijzig('scholen', { logo: data }, { id:'eq.' + school.id })
        .then(function () { KB.zetHuisstijl(school.huisstijl, data); return KBV.herstart(); })
        .then(function () { teken(); meld('Logo opgeslagen'); });
    }).catch(function (e) {
      meld('Dat lukte niet: ' + ((e && e.message) || 'onbekend'));
    });
  }, 'stil'));

  if (huidigLogo) {
    rij.appendChild(knop('Logo weghalen', 'stil', function () {
      SB.wijzig('scholen', { logo: null }, { id:'eq.' + school.id })
        .then(function () { KB.zetHuisstijl(school.huisstijl, null); return KBV.herstart(); })
        .then(function () { teken(); meld('Logo weggehaald'); },
              function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
  }
  p.appendChild(rij);
  return p;
}

/* ── de kleuren ───────────────────────────────────────────────────── */

/* ── foto's van kinderen ──────────────────────────────────────────────
   Standaard uit, en dat is de kant waar je op moet vallen. Een foto van
   een kleuter is het zwaarste wat deze app bewaart; dat hoort een keuze
   te zijn die iemand maakt en niet een stand die iemand overkomt.

   Wat er bij het uitzetten níét gebeurt: de foto's die er al zijn
   verdwijnen niet. Ze komen alleen niet meer in beeld. Weggooien bij
   het omzetten van een schakelaar is onomkeerbaar werk doen namens een
   collega die er niet bij zit. Wie ze echt weg wil, haalt ze per kind
   weg -- of draait de hele school uit en heft hem op. */
function kindfotoPaneel(){
  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'Foto\u2019s van kinderen'));
  if (!alleenBeheerder(p)) return p;

  var aan = KB.kindfotosAan();
  p.appendChild(el('p', 'hint',
    'Staat dit uit, dan kan niemand een foto van een kind kiezen en komen ' +
    'bestaande foto\u2019s niet in beeld. In plaats daarvan staat er een picto ' +
    'of de eerste letter van de naam. Picto\u2019s blijven altijd werken \u2014 ' +
    'een getekend konijn is geen foto.'));
  p.appendChild(el('p', 'hint',
    'Zet je het uit, dan worden de foto\u2019s niet weggegooid. Ze komen terug ' +
    'zodra je het weer aanzet. Wil je ze echt kwijt, haal ze dan per kind weg.'));

  var rij = el('div', 'knoprij-onder');
  var knopje = knop(aan ? 'Foto\u2019s uitzetten' : 'Foto\u2019s aanzetten',
                    aan ? 'stil' : 'primair', function () {
    if (aan) { zetFotos(false); return; }
    /* Aanzetten gaat niet zomaar. Niet omdat het technisch iets voorstelt,
       maar omdat dit het moment is waarop iemand er één keer over moet
       nadenken -- en dat moment komt nooit meer terug. */
    vraagBevestiging('Foto\u2019s van kinderen aanzetten?',
      'Dan kunnen leerkrachten een foto van een kind kiezen. Die foto staat ' +
      'daarna op het digibord in de klas en op de server. Zorg dat je ouders ' +
      'hiervoor toestemming hebben gevraagd \u2014 dat regelt de school, niet de app.',
      'Aanzetten', function () { zetFotos(true); });
  });
  rij.appendChild(knopje);
  p.appendChild(rij);

  var stand = el('div', 'hint');
  stand.style.marginTop = '8px';
  stand.textContent = aan
    ? 'Foto\u2019s staan nu aan.'
    : 'Foto\u2019s staan nu uit. Dit is de standaard.';
  p.appendChild(stand);
  return p;
}

function zetFotos(aan){
  var wie = KBV.wie();
  var school = (wie && wie.school) || {};
  SB.wijzig('scholen', { kindfotos: !!aan }, { id:'eq.' + school.id })
    .then(function () {
      return SB.roep('noteer', { wat: aan ? 'kindfoto\u2019s aangezet' : 'kindfoto\u2019s uitgezet',
                                 school: school.id, waarover: school.naam })
        .catch(function () {});
    })
    .then(function () { KB.zetKindfotos(!!aan); return KBV.herstart(); })
    .then(function () {
      teken();
      meld(aan ? 'Foto\u2019s van kinderen staan aan' : 'Foto\u2019s van kinderen staan uit');
    }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
}

function huisstijlPaneel(){
  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'De kleuren van de school'));
  if (!alleenBeheerder(p)) return p;

  p.appendChild(el('p', 'hint',
    'Standaard staat het keuzebord in de kleuren van Pixelplein. Zes kleuren zijn ' +
    'aan te passen; de rest rekent de app daaruit. Ze gelden voor iedereen van de ' +
    'school, op elk apparaat. Het bord houdt daarnaast zijn eigen sfeer per groep \u2014 ' +
    'die stel je bij Uiterlijk in.'));

  var school = (KBV.wie() && KBV.wie().school) || {};
  /* Een werkkopie: pas bij Bewaren gaat hij naar de server. Tot die tijd
     mag je rustig rondschuiven en terug. */
  var nu = {};
  KB.HUISSTIJL_UITLEG.forEach(function (u) {
    nu[u[0]] = KB.huisstijlKleur(school.huisstijl, u[0]);
  });

  var rij = el('div', 'huisstijlrij');
  var proef = el('div', 'huisstijlproef');
  var pk = el('div', 'pk', 'Groep 1A');
  var pt = el('p', 'pt', 'Zo ziet een scherm er dan uit.');
  var pkaart = el('div', 'pkaart');
  var pbeurt = el('span', 'pbeurt', 'Aan de beurt');
  pkaart.appendChild(pbeurt);
  var pknop = el('div', 'pknop', 'Bord openen');
  proef.appendChild(pk); proef.appendChild(pt);
  proef.appendChild(pkaart); proef.appendChild(pknop);

  var oordeel = el('div', 'leesbaarheid');

  function toonProef(){
    proef.style.background = nu.grond;
    pk.style.color = nu.inkt;
    pt.style.color = KB.mengMetWit(nu.inkt, 0.28);
    pkaart.style.background = nu.kaart;
    pkaart.style.color = nu.inkt;
    pbeurt.style.background = nu.warm;
    pbeurt.style.color = nu.inkt;
    pknop.style.background = nu.knop;

    /* Met zes kleuren kan een school zichzelf onleesbaar maken. Dat
       verbieden we niet -- het is hun school -- maar we zeggen het wel,
       en we zeggen erbij wát er niet leest. */
    leeg(oordeel);
    var lijst = KB.huisstijlLeesbaarheid(nu);
    var slecht = lijst.filter(function (x) { return x.oordeel !== 'goed'; });
    if (!slecht.length) {
      var goed = el('div', 'leesregel goed', 'Alles is goed leesbaar.');
      oordeel.appendChild(goed);
      return;
    }
    slecht.forEach(function (x) {
      oordeel.appendChild(el('div', 'leesregel ' + x.oordeel,
        x.wat + ': ' + (x.oordeel === 'slecht' ? 'slecht leesbaar' : 'krap') +
        ' (contrast ' + x.waarde.toString().replace('.', ',') + ')'));
    });
  }

  KB.HUISSTIJL_UITLEG.forEach(function (u) {
    var vak = el('div', 'huisstijlkleur');
    var kiezer = el('input');
    kiezer.type = 'color';
    kiezer.value = nu[u[0]];
    kiezer.setAttribute('aria-label', u[1]);
    kiezer.addEventListener('input', function () {
      nu[u[0]] = kiezer.value.toLowerCase();
      toonProef();
    });
    vak.appendChild(kiezer);
    vak.appendChild(el('div', 'n', u[1]));
    vak.appendChild(el('div', 's', u[2]));
    rij.appendChild(vak);
  });
  rij.appendChild(proef);
  toonProef();
  p.appendChild(rij);
  p.appendChild(oordeel);

  function bewaarKleuren(waarden){
    return SB.wijzig('scholen', { huisstijl: waarden }, { id:'eq.' + school.id })
      .then(function () {
        KB.zetHuisstijl(waarden);
        return KBV.herstart();
      })
      .then(function () { teken(); });
  }

  var knoppen = el('div', 'knoprij-onder');
  knoppen.appendChild(knop('Bewaren', 'primair', function () {
    bewaarKleuren(nu).then(function () { meld('De kleuren staan aan'); },
      function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
  }));
  knoppen.appendChild(knop('Terug naar Pixelplein', 'stil', function () {
    bewaarKleuren({}).then(function () { meld('Terug naar de standaardkleuren'); },
      function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
  }));
  p.appendChild(knoppen);
  return p;
}

/* ── hulp van de leverancier ──────────────────────────────────────────
   Wie dit product levert komt niet bij de kinderen, de borden of de
   statistieken van deze school. Moet er toch iemand meekijken, dan zet
   de schoolbeheerder die deur zelf open -- hier, niet daar. Hij loopt
   vanzelf af, en alles wat er gebeurt komt in het logboek hieronder.

   Zie docs/ROLLEN.md voor waarom dit zo is en niet andersom. */

var deurNu = null;        // de open deur van deze school, als die er is
var logboekNu = null;     // de laatste regels uit het logboek

function haalDeur(){
  if (!metServer()) return Promise.resolve();
  return Promise.all([
    SB.lees('ondersteuning', { kies:'*', volgorde:'tot.desc', hoeveel:20 }),
    SB.lees('handelingen',   { kies:'*', volgorde:'tijd.desc', hoeveel:25 })
  ]).then(function (uit) {
    var nu = Date.now();
    deurNu = (uit[0] || []).filter(function (d) {
      return !d.ingetrokken && new Date(d.tot).getTime() > nu;
    })[0] || null;
    logboekNu = uit[1] || [];
  }, function () { deurNu = null; logboekNu = null; });
}

function tijdstip(t){
  if (!t) return '—';
  var d = new Date(t);
  return d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' }) + ' ' +
         d.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
}

function ondersteuningPaneel(){
  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'Hulp van de leverancier'));

  if (!KBV.wie() || KBV.wie().profiel.rol !== 'schoolbeheerder') {
    p.appendChild(el('p', 'hint',
      'Alleen de schoolbeheerder kan dit aanzetten.'));
    return p;
  }

  if (deurNu) {
    var open = el('div', 'rij');
    var tekst = el('div');
    tekst.appendChild(el('div', 'rij-naam', 'Er kan nu worden meegekeken'));
    tekst.appendChild(el('div', 'rij-sub',
      'Tot ' + tijdstip(deurNu.tot) +
      (deurNu.reden ? ' \u00b7 ' + deurNu.reden : '') +
      '. Alles wat er gebeurt komt hieronder in het logboek te staan.'));
    open.appendChild(tekst);
    var acties = el('div', 'rij-acties');
    acties.appendChild(knop('Nu dichtdoen', 'gevaar', function () {
      SB.roep('ondersteuning_intrekken', {}).then(function () {
        return haalDeur().then(function () { teken(); meld('De deur is dicht'); });
      }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    open.appendChild(acties);
    p.appendChild(open);
    return p;
  }

  p.appendChild(el('p', 'hint',
    'Wie dit product levert kan niet bij jullie kinderen, borden of statistieken. ' +
    'Is er een probleem waar iemand naar moet kijken, dan zet jij de deur hier ' +
    'tijdelijk open. Hij gaat vanzelf weer dicht, en elke handeling komt in het ' +
    'logboek dat je hieronder ziet.'));
  var rij = el('div', 'knoprij-onder');
  rij.appendChild(knop('Deur openzetten', 'stil', toonDeurBlad));
  p.appendChild(rij);
  return p;
}

function toonDeurBlad(){
  var concept = { reden:'', uren:4 };
  toonBlad(function (blad) {
    var t = el('div', null, 'Meekijken toestaan');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Zolang de deur openstaat kan de leverancier bij de groepen van deze school: ' +
      'de kinderen, de borden en de statistieken. Zet hem niet langer open dan nodig.'));

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Waar gaat het over?'));
    var reden = el('input', 'invoer');
    reden.type = 'text';
    reden.placeholder = 'Het bord van 1A loopt vast bij het afsluiten';
    reden.addEventListener('input', function () { concept.reden = reden.value; });
    r1.appendChild(reden);
    blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'Hoe lang'));
    var chips = el('div', 'knoprij');
    [[1, 'Een uur'], [4, 'Vier uur'], [8, 'Een werkdag']].forEach(function (paar) {
      var c = el('button', 'chip' + (concept.uren === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        concept.uren = paar[0];
        Array.prototype.forEach.call(chips.children, function (x) { x.classList.remove('aan'); });
        c.classList.add('aan');
      });
      chips.appendChild(c);
    });
    r2.appendChild(chips);
    blad.appendChild(r2);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Deur openzetten', 'primair', function () {
      var r = (concept.reden || '').trim();
      if (!r) { meld('Schrijf er even bij waar het over gaat'); return; }
      SB.roep('ondersteuning_toestaan', { reden: r, uren: concept.uren })
        .then(function () {
          sluitBlad();
          return haalDeur().then(function () { teken(); meld('De deur staat open'); });
        }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    blad.appendChild(rij);
    setTimeout(function () {
      if (!blad.contains(document.activeElement)) reden.focus();
    }, 60);
  });
}

/* ── alles meekrijgen ────────────────────────────────────────────────
   Van de school, dus de school haalt hem zelf op. De leverancier kan er
   niet bij en hoeft er ook niet bij: het is niet zijn bestand. */
function uitdraaiPaneel(){
  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'Alles uitdraaien'));
  if (!KBV.wie() || KBV.wie().profiel.rol !== 'schoolbeheerder') {
    p.appendChild(el('p', 'hint', 'Alleen de schoolbeheerder kan dit.'));
    return p;
  }
  p.appendChild(el('p', 'hint',
    'Eén bestand met alles van deze school: de groepen, de kinderen, de hoeken, ' +
    'de borden, wat er op het bord is gebeurd en het logboek. Handig als je ' +
    'ergens anders naartoe gaat, of als iemand vraagt wat jullie bewaren.'));
  p.appendChild(el('p', 'hint',
    'Er staan voornamen van kinderen in. Bewaar het bestand zoals je een ' +
    'klassenlijst bewaart.'));
  var rij = el('div', 'knoprij-onder');
  rij.appendChild(knop('Uitdraaien', 'stil', function () {
    meld('Bezig met uitdraaien\u2026');
    SB.roep('school_export', {}).then(function (pak) {
      var tekst = JSON.stringify(pak, null, 1);
      var naam = 'keuzebord-' +
        ((pak && pak.school && pak.school.naam) || 'school')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
        '-' + new Date().toISOString().slice(0, 10) + '.json';
      var blob = new Blob([tekst], { type:'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = naam;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      meld('Klaar \u00b7 ' + Math.round(tekst.length / 1024) + ' kB');
      haalDeur().then(teken, function () {});
    }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
  }));
  p.appendChild(rij);
  return p;
}

function logboekPaneel(){
  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'Logboek'));
  if (!logboekNu || !logboekNu.length) {
    p.appendChild(el('p', 'hint',
      'Hier komt te staan wie er wanneer bij jullie gegevens is geweest. ' +
      'Nog niets gebeurd.'));
    return p;
  }
  logboekNu.forEach(function (r) {
    var rij = el('div', 'ledenrij');
    var links = el('div');
    /* Wat de leverancier deed, staat er met zoveel woorden bij: dat is
       precies wat een school in haar logboek wil kunnen terugvinden. */
    var door = (r.gegevens && r.gegevens.door === 'leverancier') ? 'Pixelplein (leverancier): ' : '';
    links.appendChild(el('div', 'ledennaam', door + r.wat + (r.waarover ? ' \u2014 ' + r.waarover : '')));
    links.appendChild(el('div', 'ledenmail', tijdstip(r.tijd)));
    rij.appendChild(links);
    p.appendChild(rij);
  });
  p.appendChild(el('p', 'hint',
    'Deze regels kan niemand wijzigen of wissen, ook de leverancier niet.'));
  return p;
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
    /* Hernoemen kon al bij Beheer → Groep, maar daar zoekt niemand het
       als hij hier naar zes groepen staat te kijken. */
    acties.appendChild(knop('Naam', 'stil', function () { hernoemGroep(k); }));
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

/* De naam van een groep. Dit verandert twee dingen tegelijk: de groep
   op dit apparaat en de rij op de server. Dat moet, want het beheer van
   de leerkracht leest de ene en het schoolbeheer de andere -- lopen ze
   uiteen, dan ziet de juf een andere naam dan haar schoolbeheerder. */
function hernoemGroep(k){
  toonBlad(function (blad) {
    blad.appendChild(el('h3', 'titel', 'Naam van de groep'));
    blad.appendChild(el('p', 'hint', k.naam));
    var veld = el('div', 'veldrij');
    veld.appendChild(el('label', 'veldlabel', 'Naam'));
    var invoer = el('input', 'invoer');
    invoer.type = 'text'; invoer.value = k.naam;
    invoer.placeholder = 'Groep 1A';
    veld.appendChild(invoer);
    blad.appendChild(veld);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Opslaan', 'primair', function () {
      var n = invoer.value.trim();
      if (!n) { meld('Een groep heeft een naam nodig'); invoer.focus(); return; }
      k.naam = n;
      bewaar();
      var sid = KBSYNC.opServer(k.id);
      var opServer = sid
        ? SB.wijzig('groepen', { naam: n }, { id:'eq.' + sid })
        : Promise.resolve();
      opServer.then(function () {
        sluitBlad(); tekenMenu(); teken(); meld('Naam opgeslagen');
      }, function (e) {
        /* Lokaal staat hij al goed; alleen de server weet het nog niet.
           Dat eerlijk zeggen in plaats van doen alsof het klaar is. */
        sluitBlad(); teken();
        meld('Opgeslagen op dit apparaat, maar de server wist het nog niet: ' +
             ((e && e.message) || 'onbekend'));
      });
    }));
    blad.appendChild(rij);
    zetCursor(invoer, blad);
  });
}

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
  kopknoppen.appendChild(knop('Collega toevoegen', 'primair', function () { toonCollegaToevoegen(); }));
  kop.appendChild(kopknoppen);
  p.appendChild(kop);
  p.appendChild(el('p', 'hint',
    'Een account maak je niet hier, maar door iemand uit te nodigen op zijn of haar ' +
    'e-mailadres. Zodra die persoon naar de site gaat en op "Er een maken" klikt met datzelfde ' +
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
      (mens.gebruikersnaam ? mens.gebruikersnaam + ' \u00b7 ' : '') +
      (groepen.length ? groepen.sort().join(', ') : 'nog geen groep')));
    rij.appendChild(links);
    rij.appendChild(knop('Nieuw wachtwoord', 'stil', function () {
      vraagNieuwWachtwoord(mens);
    }));
    p.appendChild(rij);
  });

  var beheerders = alleCollegas.filter(function (x) { return x.rol === 'schoolbeheerder'; });
  beheerders.forEach(function (mens) {
    var rij = el('div', 'ledenrij');
    var links = el('div');
    links.appendChild(el('div', 'ledennaam', mens.naam || mens.email));
    links.appendChild(el('div', 'ledenmail',
      (mens.gebruikersnaam ? mens.gebruikersnaam + ' \u00b7 ' : '') +
      'schoolbeheerder \u2014 mag bij alle groepen'));
    rij.appendChild(links);
    rij.appendChild(knop('Nieuw wachtwoord', 'stil', function () {
      vraagNieuwWachtwoord(mens);
    }));
    p.appendChild(rij);
  });

  if (openVerzoeken.length) {
    p.appendChild(el('div', 'restvak-kop', 'Vraagt toegang'));
    openVerzoeken.forEach(function (v) {
      var wie = perProfiel[v.profiel_id];
      var rij = el('div', 'ledenrij wacht');
      var links = el('div');
      links.appendChild(el('div', 'ledennaam',
        (wie ? (wie.naam || wie.email) : 'een collega') + ' vraagt ' +
        (naamVanGroep[v.groep_id] || 'een groep')));
      links.appendChild(el('div', 'ledenmail', v.reden
        ? '\u201c' + v.reden + '\u201d'
        : 'geen toelichting erbij'));
      rij.appendChild(links);
      rij.appendChild(knop('Goedkeuren', 'primair', function () {
        beslis(v, true);
      }));
      rij.appendChild(knop('Afwijzen', 'stil', function () {
        beslis(v, false);
      }));
      p.appendChild(rij);
    });
  }

  if (openUitnodigingen.length) {
    p.appendChild(el('div', 'restvak-kop', 'Nog niet aangemeld'));
    openUitnodigingen.forEach(function (u) {
      var rij = el('div', 'ledenrij wacht');
      var links = el('div');
      links.appendChild(el('div', 'ledennaam', u.email));
      links.appendChild(el('div', 'ledenmail',
        (u.rol === 'schoolbeheerder' ? 'schoolbeheerder' : 'leerkracht') +
        (u.groep_id && naamVanGroep[u.groep_id] ? ' · ' + naamVanGroep[u.groep_id] : '') +
        ' — wacht tot die persoon een account maakt'));
      if (u.code) {
        var codeRegel = el('div', 'ledencode', 'code ' + codeLeesbaar(u.code));
        links.appendChild(codeRegel);
      }
      rij.appendChild(links);
      if (u.code) rij.appendChild(knop('Code tonen', 'stil', function () {
        toonCode(u.email, u.code);
      }));
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

/* Goedkeuren of afwijzen gaat in één stap in de database: goedkeuren zonder
   koppelen zou een belofte zijn die niemand nakomt. */
function beslis(verzoek, toekennen){
  SB.roep('verzoek_behandelen', { verzoek: verzoek.id, toekennen: !!toekennen })
    .then(function () { return KBV.herstart().catch(function () {}); })
    .then(haalMensen)
    .then(function () {
      teken();
      meld(toekennen ? 'Toegang gegeven' : 'Verzoek afgewezen');
    }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
}

/* De code laten zien zodra de uitnodiging klaarstaat. Dit is de weg die
   het altijd doet: jij leest hem voor, je collega typt hem in. De mail eronder is
   extra gemak -- zonder eigen mailserver stuurt Supabase er maar een
   handjevol per uur en belandt hij vaak in de ongewenste post. */
function toonCode(email, code){
  toonBlad(function (blad) {
    blad.appendChild(el('h3', 'titel', 'Uitnodiging staat klaar'));
    blad.appendChild(el('p', 'hint',
      'Geef ' + email + ' het adres van deze site én de code hieronder. Ze maakt ' +
      'zelf een account en vult dan de code in — daarna zit ze bij de goede school ' +
      'en groep. De code werkt één keer en vervalt na drie weken.'));

    var vak = el('div', 'codevak');
    vak.appendChild(el('div', 'codetekst', codeLeesbaar(code)));
    blad.appendChild(vak);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Code kopiëren', 'stil', function () {
      var tekst = codeLeesbaar(code);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tekst).then(function () { meld('Code gekopieerd'); },
                                                  function () { meld('Kopiëren lukte niet — schrijf hem over'); });
      } else meld('Kopiëren kan hier niet — schrijf hem over');
    }));
    rij.appendChild(knop('Ook een inloglink mailen', 'stil', function () {
      meld('Bezig met versturen…');
      SB.inloglinkSturen(email).then(function () {
        meld('Er is een inloglink gestuurd naar ' + email + '. Komt hij niet aan, ' +
             'dan werkt de code gewoon.');
      }, function (e) {
        meld('Mailen lukte niet (' + (e && e.message || 'onbekend') + '). ' +
             'Geef de code door.');
      });
    }));
    rij.appendChild(knop('Klaar', 'primair', sluitBlad));
    blad.appendChild(rij);
  });
}

/* ══════════════════════════════════════════════════════════
   EEN COLLEGA ERBIJ
   Eén knop: naam invullen, account staat klaar, kaartje eruit.

   Hiervoor stond hier een uitnodiging: de schoolbeheerder vulde een
   e-mailadres in en haar collega maakte zelf een account. Dat werkte,
   maar het vroeg van een testleerkracht dat ze zich ergens aanmeldt
   voordat ze iets kan zien -- en het zette van elke juf een echt
   adres in dit systeem.

   De uitnodiging is niet weg: hij is nu de binnenkant. We zetten er
   een klaar op het interne adres en maken meteen het account aan; de
   trekker nieuw_profiel() in de database koppelt dan school, rol en
   groep. Zo blijft er één plek waar bepaald wordt bij welke school
   iemand hoort, en die plek zit niet in een browser.
   ══════════════════════════════════════════════════════════ */

function naamNaarGebruikersnaam(naam){
  return SB.gebruikersnaamNet(String(naam || '')
    .replace(/\b(juf|meester|meneer|mevrouw)\b/gi, ''));
}

function toonCollegaToevoegen(concept){
  concept = concept || { naam:'', gebruikersnaam:'', zelfGekozen:false,
                         rol:'leerkracht', groepId:'' };
  toonBlad(function (blad) {
    blad.appendChild(el('h3', 'titel', 'Een collega erbij'));
    blad.appendChild(el('p', 'hint',
      'Vul haar naam in. Het account staat meteen klaar en je krijgt een kaartje ' +
      'om uit te printen \u2014 daar staat op hoe ze inlogt. Er gaat van ons geen ' +
      'mail uit; geef het kaartje zelf even.'));

    var veld = el('div', 'veldrij');
    veld.appendChild(el('label', 'veldlabel', 'Naam'));
    var invoer = el('input', 'invoer');
    invoer.type = 'text'; invoer.placeholder = 'Juf Marieke';
    invoer.value = concept.naam;
    veld.appendChild(invoer);
    blad.appendChild(veld);

    var gveld = el('div', 'veldrij');
    gveld.appendChild(el('label', 'veldlabel', 'Gebruikersnaam'));
    var ginvoer = el('input', 'invoer');
    ginvoer.type = 'text'; ginvoer.placeholder = 'juf.marieke';
    ginvoer.autocapitalize = 'off'; ginvoer.spellcheck = false;
    ginvoer.value = concept.gebruikersnaam;
    gveld.appendChild(ginvoer);
    var gstand = el('div', 'hint');
    gstand.style.marginTop = '4px';
    gveld.appendChild(gstand);
    blad.appendChild(gveld);

    /* Vóór het aanmaken kijken of de naam vrij is, niet erna. Hoort
       iemand pas bij het opslaan dat de naam bezet is, dan staat ze al
       een kaartje te printen. */
    var kijker = null;
    function kijkNaam(){
      var n = concept.gebruikersnaam;
      clearTimeout(kijker);
      gstand.style.color = '';
      if (!n) { gstand.textContent = ''; return; }
      gstand.textContent = 'Even kijken\u2026';
      kijker = setTimeout(function () {
        SB.roep('gebruikersnaam_vrij', { gewenst: n }).then(function (vrij) {
          gstand.textContent = vrij
            ? 'Vrij. Ze logt straks in met ' + n + '.'
            : 'Die naam is al in gebruik. Kies een andere, bijvoorbeeld ' + n + '2.';
          gstand.style.color = vrij ? '' : 'var(--stop)';
        }, function () { gstand.textContent = ''; });
      }, 350);
    }

    /* De gebruikersnaam volgt de naam, tot iemand hem zelf aanpast.
       Daarna blijft hij staan: niets is vervelender dan een veld dat je
       net hebt ingevuld en dat zichzelf weer overschrijft. */
    invoer.addEventListener('input', function () {
      concept.naam = invoer.value;
      if (!concept.zelfGekozen) {
        ginvoer.value = naamNaarGebruikersnaam(invoer.value);
        concept.gebruikersnaam = ginvoer.value;
        kijkNaam();
      }
    });
    ginvoer.addEventListener('input', function () {
      concept.zelfGekozen = true;
      ginvoer.value = SB.gebruikersnaamNet(ginvoer.value);
      concept.gebruikersnaam = ginvoer.value;
      kijkNaam();
    });
    if (concept.gebruikersnaam) kijkNaam();

    var rolrij = el('div', 'veldrij');
    rolrij.appendChild(el('label', 'veldlabel', 'Wat mag deze collega?'));
    var chips = el('div', 'knoprij');
    [['leerkracht', 'Leerkracht \u2014 alleen de eigen groepen'],
     ['schoolbeheerder', 'Schoolbeheerder \u2014 alles']].forEach(function (paar) {
      var c = el('button', 'chip' + (concept.rol === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        concept.rol = paar[0]; sluitBlad(); toonCollegaToevoegen(concept);
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
        concept.groepId = ''; sluitBlad(); toonCollegaToevoegen(concept);
      });
      gchips.appendChild(geen);
      KB.G.klassen.forEach(function (k) {
        var sid = KBSYNC.opServer(k.id);
        if (!sid) return;
        var c = el('button', 'chip' + (concept.groepId === sid ? ' aan' : ''), k.naam);
        c.addEventListener('click', function () {
          concept.groepId = sid; sluitBlad(); toonCollegaToevoegen(concept);
        });
        gchips.appendChild(c);
      });
      grij.appendChild(gchips);
      blad.appendChild(grij);
    }

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    var maak = knop('Account aanmaken', 'primair', function () {
      var naam = (concept.naam || '').trim();
      var gn = SB.gebruikersnaamNet(concept.gebruikersnaam);
      if (!naam) { meld('Vul haar naam in'); invoer.focus(); return; }
      if (!gn)   { meld('Vul een gebruikersnaam in'); ginvoer.focus(); return; }

      var ww;
      try { ww = KBKAARTJE.wachtwoord(); }
      catch (e) { meld('Deze browser kan geen veilig wachtwoord maken. Probeer een andere.'); return; }

      maak.disabled = true;
      maak.textContent = 'Bezig\u2026';

      /* Eerst de uitnodiging, dan het account. In die volgorde, want de
         trekker die school en rol koppelt kijkt bij het aanmaken of er
         een uitnodiging klaarligt. Andersom zou ze binnen zijn zonder
         school, en dan staat ze voor het scherm "begin een school". */
      var uitnodiging = { school_id: KBV.wie().profiel.school_id,
                          email: SB.inlogadres(gn), rol: concept.rol,
                          code: nieuweCode() };
      if (concept.rol === 'leerkracht' && concept.groepId) uitnodiging.groep_id = concept.groepId;

      SB.schrijf('uitnodigingen', [uitnodiging])
        .then(function () { return SB.maakAccountVoor(gn, ww, naam); })
        .then(function () { return haalMensen(); })
        .then(function () {
          sluitBlad(); teken();
          toonKaartje({ naam: naam, gebruikersnaam: gn, wachtwoord: ww, rol: concept.rol });
        }, function (e) {
          maak.disabled = false;
          maak.textContent = 'Account aanmaken';
          var bericht = (e && e.message) || '';
          if (SB.isTeVaak(e)) {
            meld('Supabase laat maar dertig aanmeldingen per vijf minuten toe vanaf \u00e9\u00e9n plek. Wacht vijf minuten en ga dan verder \u2014 er is niets misgegaan.');
          } else if (/duplicate|unique|al een account|already/i.test(bericht)) {
            meld('Die gebruikersnaam is al in gebruik. Kies een andere.');
          } else {
            meld('Dat lukte niet: ' + bericht);
          }
        });
    });
    rij.appendChild(maak);
    blad.appendChild(rij);
    zetCursor(invoer, blad);
  });
}

/* ── een nieuw wachtwoord ─────────────────────────────────────────────
   Niemand kan een wachtwoord terugkijken, ook de schoolbeheerder niet.
   Dat is met opzet: een lijst met wachtwoorden die ergens blijft
   liggen is gevaarlijker dan een juf die er af en toe een nieuw moet
   vragen. Wat hier gebeurt is dus geen "opzoeken" maar "vervangen" --
   en daarmee is het oude wachtwoord meteen onbruikbaar.

   Vandaar de waarschuwing vooraf: staat zij op dit moment ingelogd op
   het digibord, dan blijft dat werken tot ze uitlogt, maar de volgende
   keer heeft ze het nieuwe kaartje nodig. */
function vraagNieuwWachtwoord(mens){
  var wie = mens.naam || mens.gebruikersnaam || mens.email;
  vraagBevestiging('Nieuw wachtwoord voor ' + wie + '?',
    'Het oude wachtwoord werkt daarna niet meer. Je krijgt een nieuw kaartje om ' +
    'uit te printen; daarna kan niemand het meer opzoeken, ook jij niet.',
    'Nieuw wachtwoord', function () {
      var ww;
      try { ww = KBKAARTJE.wachtwoord(); }
      catch (e) { meld('Deze browser kan geen veilig wachtwoord maken. Probeer een andere.'); return; }
      SB.roep('wachtwoord_zetten', { wie: mens.id, nieuw: ww }).then(function () {
        toonKaartje({ naam: mens.naam || wie, gebruikersnaam: mens.gebruikersnaam || '',
                      wachtwoord: ww, rol: mens.rol });
      }, function (e) {
        meld('Dat lukte niet: ' + (e && e.message));
      });
    });
}

/* Het kaartje zelf wordt getekend door src/kb-kaartje.js, omdat het
   platformbeheer hetzelfde kaartje nodig heeft. Hier staan alleen de
   knoppen eronder: vensters en meldingen werken per scherm anders. */
function toonKaartje(gegevens){
  gegevens.school = (KBV.wie() && KBV.wie().school && KBV.wie().school.naam) || '';
  toonBlad(function (blad) {
    var kop = el('div', 'nietprinten');
    kop.appendChild(el('h3', 'titel', 'Het account staat klaar'));
    kop.appendChild(el('p', 'hint',
      'Print dit kaartje of schrijf het over, en geef het aan ' + gegevens.naam + '. ' +
      'Het wachtwoord staat hierna nergens meer \u2014 wij bewaren het niet, en ook jij ' +
      'kunt het straks niet opzoeken. Raakt ze het kwijt, dan maak je een nieuw.'));
    blad.appendChild(kop);

    blad.appendChild(KBKAARTJE.bouw(gegevens));

    var rij = el('div', 'knoprij-onder nietprinten');
    rij.appendChild(knop('Printen', 'primair', function () { window.print(); }));
    rij.appendChild(knop('Kopi\u00ebren', 'stil', function () {
      KBKAARTJE.kopieer(gegevens).then(
        function () { meld('Gekopieerd'); },
        function () { meld('Kopi\u00ebren lukte niet \u2014 schrijf het over'); });
    }));
    rij.appendChild(knop('Klaar', 'stil', sluitBlad));
    blad.appendChild(rij);
  });
}


KB.laad();
KB.doelenZorg()
  .then(function () { return window.KBV ? KBV.zodraKlaar() : Promise.resolve({ lokaal:true }); })
  .then(haalMensen)
  .then(function () { return haalDeur(); })
  .then(function () { return KB.fkLees(); })
  .then(function (m) { if (m) KB.fkPasToe(m); })
  .catch(function () {})
  .then(function () { tekenMenu(); teken(); });

})();
