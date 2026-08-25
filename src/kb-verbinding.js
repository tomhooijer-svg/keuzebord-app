/* ═══════════════════════════════════════════════════════════════════════
   De lijm tussen de schermen en de server

   Elk van de drie schermen begint hetzelfde: kijken wie er is ingelogd,
   ophalen bij welke groepen die persoon mag, en de groep van dit apparaat
   binnenhalen. Daarna houdt deze laag het bij: wat er opgeslagen wordt
   gaat weg zodra het kan, en af en toe halen we op wat een ander apparaat
   heeft gedaan.

   Alles hier is zo gebouwd dat een haperende verbinding niets kapotmaakt.
   Het scherm draait door op wat er in de browser staat; de server is waar
   het samenkomt, niet waar het op wacht.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
'use strict';

var WACHT_NA_OPSLAAN = 1500;    // even wachten: tien wijzigingen = één keer sturen
var HAAL_ELKE        = 30000;   // hoe vaak we kijken of een ander iets deed

var ik      = null;    // profiel, school, groepen
var groepId = null;    // welke servergroep dit scherm toont
var klasId  = null;    // en hoe die lokaal heet
var timer   = null;
var bezig   = false;
var luisteraars = [];

function meldStand(stand, extra){
  luisteraars.forEach(function (fn) {
    try { fn(stand, extra || {}); } catch (e) {}
  });
}

/* ── de groepen van deze persoon lokaal klaarzetten ──────────────────── */
/* Voor elke groep op de server hoort er één in de browser te staan. Zo kan
   het scherm gewoon met KB.klas() blijven werken en merkt het niets van
   de vertaling. */

function zorgVoorGroepen(){
  var gemaakt = false;
  (ik.groepen || []).forEach(function (g) {
    var lokaal = KBSYNC.opLokaal(g.id);
    var bestaat = lokaal && (KB.G.klassen || []).some(function (k) { return k.id === lokaal; });
    if (bestaat) return;
    var k = KB.leegKlas(g.naam);
    KB.G.klassen.push(k);
    KBSYNC.koppel(k.id, g.id);
    gemaakt = true;
  });

  // Groepen die van de server verdwenen zijn horen hier ook weg. En de
  // lege groep die de app zelf verzint als de browser nog niets weet:
  // zodra we ingelogd zijn komen de echte groepen van de server.
  // Een groep zonder koppeling waar wél in gewerkt is laten we staan --
  // liever iets te veel dan iemands werk weggooien.
  var serverIds = (ik.groepen || []).map(function (g) { return g.id; });
  var houden = (KB.G.klassen || []).filter(function (k) {
    var op = KBSYNC.opServer(k.id);
    if (op) return serverIds.indexOf(op) >= 0;
    var leeg = !(k.leerlingen || []).length && !(k.hoekLib || []).length &&
               !(k.taken || []).length && !Object.keys(k.weken || {}).length;
    return !leeg;
  });
  if (houden.length !== (KB.G.klassen || []).length) { KB.G.klassen = houden; gemaakt = true; }

  if (gemaakt) KB.bewaar();
}

/* Welke groep hoort bij dit scherm? Een leerkracht heeft er meestal maar
   één; op het digibord is er ooit een gekozen en die onthouden we. */
function kiesGroep(){
  var onthouden = KB.beheerKlasId();
  if (onthouden && KBSYNC.opServer(onthouden)) return onthouden;
  var eerste = (ik.groepen || [])[0];
  if (!eerste) return null;
  var lokaal = KBSYNC.opLokaal(eerste.id);
  if (lokaal) KB.zetBeheerKlas(lokaal);
  return lokaal;
}

/* ── heen en weer ────────────────────────────────────────────────────── */

function stuurNu(){
  if (bezig || !klasId || !groepId) return Promise.resolve();
  bezig = true;
  meldStand('bezig');
  return KBSYNC.stuurOp(klasId, groepId, ik.profiel.school_id).then(function (uit) {
    bezig = false;
    meldStand(uit.gelukt ? 'klaar' : 'wacht');
    return uit;
  }, function (e) {
    bezig = false;
    meldStand('mis', { fout: e });
    throw e;
  });
}

function planOpsturen(){
  clearTimeout(timer);
  timer = setTimeout(function () { stuurNu().catch(function () {}); }, WACHT_NA_OPSLAAN);
}

function haalOp(){
  if (bezig || !klasId || !groepId) return Promise.resolve();
  // eerst wat hier klaarstaat wegbrengen; anders overschrijft de server het
  var eerst = KBSYNC.wachtErIetsOp(klasId) ? stuurNu().catch(function () {}) : Promise.resolve();
  return eerst.then(function () {
    return KBSYNC.haalBinnen(klasId, groepId).then(function () {
      meldStand('klaar');
      return true;
    }, function (e) {
      if (e && e.offline) { meldStand('wacht'); return false; }
      throw e;
    });
  });
}

/* ── beginnen ────────────────────────────────────────────────────────── */

function start(opties){
  opties = opties || {};
  KB.laad();

  if (!SB.ingelogd()) {
    if (opties.magZonderInlog) return Promise.resolve({ ingelogd:false });
    location.href = 'inloggen.html';
    return new Promise(function () {});   // we gaan toch weg
  }

  return SB.wieBenIk().then(function (uit) {
    ik = uit;
    if (!ik.profiel) { location.href = 'inloggen.html'; return new Promise(function () {}); }
    if (!ik.profiel.school_id) { location.href = 'school.html?nieuw=1'; return new Promise(function () {}); }

    zorgVoorGroepen();
    klasId = kiesGroep();
    groepId = klasId ? KBSYNC.opServer(klasId) : null;
    if (klasId) { KB.G.activeKlasId = klasId; KB.bewaar(); }

    // vanaf nu gaat alles wat opgeslagen wordt vanzelf mee
    KB.opBewaard(planOpsturen);

    var eerste = groepId ? haalOp() : Promise.resolve(false);
    return eerste.catch(function () { return false; }).then(function (gelukt) {
      volgIntervallen();
      return { ingelogd:true, ik:ik, klasId:klasId, groepId:groepId, opgehaald:gelukt };
    });
  }, function (e) {
    // Geen verbinding bij het opstarten? Dan draaien we door op wat er in
    // de browser staat. Een klas kan niet wachten op de wifi.
    if (e && e.offline) {
      meldStand('wacht');
      klasId = KB.beheerKlasId();
      groepId = klasId ? KBSYNC.opServer(klasId) : null;
      KB.opBewaard(planOpsturen);
      volgIntervallen();
      return { ingelogd:true, offline:true, klasId:klasId, groepId:groepId };
    }
    throw e;
  });
}

var intervallenAan = false;
function volgIntervallen(){
  if (intervallenAan) return;
  intervallenAan = true;

  setInterval(function () {
    if (document.hidden) return;
    haalOp().catch(function () {});
  }, HAAL_ELKE);

  // terug op het scherm: meteen kijken of er iets veranderd is
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) haalOp().catch(function () {});
  });

  // het internet is terug
  window.addEventListener('online', function () { stuurNu().catch(function () {}); });

  // wegklikken met iets dat nog niet weg is
  window.addEventListener('pagehide', function () {
    if (KBSYNC.wachtErIetsOp(klasId)) stuurNu().catch(function () {});
  });
}

/* Opnieuw beginnen: alles bij de server ophalen alsof we net binnenkomen.
   Het schoolbeheer gebruikt dit nadat het daar groepen heeft aangemaakt. */
function herstart(){
  return SB.wieBenIk().then(function (uit) {
    ik = uit;
    zorgVoorGroepen();
    klasId = kiesGroep();
    groepId = klasId ? KBSYNC.opServer(klasId) : null;
    if (klasId) { KB.G.activeKlasId = klasId; KB.bewaar(); }
    return ik;
  });
}

/* Van groep wisselen (het schoolbeheer doet dat). */
function naarGroep(nieuwKlasId){
  var nieuwGroepId = KBSYNC.opServer(nieuwKlasId);
  if (!nieuwGroepId) return Promise.reject(new Error('Die groep staat niet op de server.'));
  return stuurNu().catch(function () {}).then(function () {
    klasId = nieuwKlasId; groepId = nieuwGroepId;
    KB.zetBeheerKlas(klasId);
    KB.G.activeKlasId = klasId; KB.bewaar();
    return haalOp();
  });
}

function afmelden(){
  // Wat nog niet weg is proberen we eerst nog te versturen -- anders raakt
  // het werk van vanmiddag kwijt aan een klik op uitloggen.
  var eerst = (klasId && KBSYNC.wachtErIetsOp(klasId))
    ? stuurNu().catch(function () {}) : Promise.resolve();
  return eerst.then(function () {
    return SB.afmelden();
  }).then(function () {
    // De groepen van deze persoon horen niet op het scherm van de
    // volgende. Wat er nog niet weg was blijft in de opslag staan, dus we
    // gooien niets weg -- we halen het alleen uit beeld.
    try {
      localStorage.removeItem('kb_beheer_klas');
    } catch (e) {}
    location.href = 'inloggen.html';
  });
}

/* ── het naamplaatje met uitloggen ────────────────────────────────────
   Elk scherm laat zien wie er is ingelogd en biedt de weg naar buiten.
   Dat is één stukje, hier, zodat het overal hetzelfde werkt en er niet
   drie versies van rondzwerven. */

function maakAccountknop(opties){
  opties = opties || {};
  if (!ik || !ik.profiel) return null;

  var naam = ik.profiel.naam || ik.profiel.email || 'ingelogd';
  var rol  = ik.profiel.rol === 'schoolbeheerder' ? 'Schoolbeheerder' : 'Leerkracht';

  var doos = document.createElement('div');
  doos.className = 'account' + (opties.klasse ? ' ' + opties.klasse : '');

  var knop = document.createElement('button');
  knop.className = 'account-knop';
  knop.type = 'button';
  knop.setAttribute('aria-haspopup', 'true');
  knop.setAttribute('aria-expanded', 'false');

  var bol = document.createElement('span');
  bol.className = 'account-bol';
  bol.textContent = (naam.charAt(0) || '?').toUpperCase();
  knop.appendChild(bol);

  var tekst = document.createElement('span');
  tekst.className = 'account-tekst';
  var r1 = document.createElement('span'); r1.className = 'account-naam'; r1.textContent = naam;
  var r2 = document.createElement('span'); r2.className = 'account-rol';  r2.textContent = rol;
  tekst.appendChild(r1); tekst.appendChild(r2);
  knop.appendChild(tekst);
  doos.appendChild(knop);

  var menu = document.createElement('div');
  menu.className = 'account-menu';

  var kop = document.createElement('div');
  kop.className = 'account-menukop';
  kop.textContent = ik.profiel.email + (ik.school ? ' · ' + ik.school.naam : '');
  menu.appendChild(kop);

  (opties.extra || []).forEach(function (item) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = item.tekst;
    b.addEventListener('click', function () { dicht(); item.doen(); });
    menu.appendChild(b);
  });

  var wissel = document.createElement('button');
  wissel.type = 'button';
  wissel.textContent = 'Wisselen van account';
  wissel.addEventListener('click', function () { dicht(); afmelden(); });
  menu.appendChild(wissel);

  var uit = document.createElement('button');
  uit.type = 'button'; uit.className = 'uitloggen';
  uit.textContent = 'Uitloggen';
  uit.addEventListener('click', function () { dicht(); afmelden(); });
  menu.appendChild(uit);

  doos.appendChild(menu);

  function open(){ doos.classList.add('open'); knop.setAttribute('aria-expanded', 'true'); }
  function dicht(){ doos.classList.remove('open'); knop.setAttribute('aria-expanded', 'false'); }

  knop.addEventListener('click', function (e) {
    e.stopPropagation();
    if (doos.classList.contains('open')) dicht(); else open();
  });
  document.addEventListener('click', function (e) {
    if (!doos.contains(e.target)) dicht();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dicht();
  });

  return doos;
}

/* ── wie mag bij welke groep ──────────────────────────────────────────
   Het schoolbeheer regelt dit. De database bewaakt het: alleen een
   schoolbeheerder mag koppelen, en alleen binnen haar eigen school. Een
   groep kan meer dan één leerkracht hebben, en een leerkracht meer dan
   één groep. */

function collegas(){
  return SB.lees('profielen', { kies:'id,naam,email,rol', volgorde:'rol,naam' });
}

/* Alle koppelingen van de school in één keer: {groepId: [profielId, ...]} */
function ledenPerGroep(){
  return SB.lees('groep_leden', { kies:'groep_id,profiel_id' }).then(function (rijen) {
    var uit = {};
    (rijen || []).forEach(function (r) {
      (uit[r.groep_id] = uit[r.groep_id] || []).push(r.profiel_id);
    });
    return uit;
  });
}

function koppelAanGroep(serverGroepId, profielId){
  return SB.schrijf('groep_leden', [{ groep_id:serverGroepId, profiel_id:profielId }]);
}

function ontkoppelVanGroep(serverGroepId, profielId){
  return SB.wis('groep_leden', { groep_id:'eq.' + serverGroepId,
                                 profiel_id:'eq.' + profielId });
}

/* Elk scherm begint hiermee. Is er geen server ingesteld -- de
   voorvertoning, of een losse kopie op een stick -- dan gaat het scherm
   gewoon door op wat er in de browser staat. */
function zodraKlaar(opties){
  if (!global.SB || !global.KBSYNC) return Promise.resolve({ lokaal:true });
  return start(opties).catch(function (e) {
    console.error('verbinding:', e);
    return { lokaal:true, fout:e };
  });
}

global.KBV = {
  start: start,
  zodraKlaar: zodraKlaar,
  stuurNu: stuurNu,
  haalOp: haalOp,
  naarGroep: naarGroep,
  herstart: herstart,
  afmelden: afmelden,
  maakAccountknop: maakAccountknop,
  collegas: collegas, ledenPerGroep: ledenPerGroep,
  koppelAanGroep: koppelAanGroep, ontkoppelVanGroep: ontkoppelVanGroep,
  wie: function () { return ik; },
  groepId: function () { return groepId; },
  klasId: function () { return klasId; },
  opStand: function (fn) { luisteraars.push(fn); }
};

})(window);
