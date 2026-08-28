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

  // Twee lokale groepen aan dezelfde servergroep gekoppeld kan niet. Komt
  // voor als er onderweg iets is misgegaan; dan houden we degene waar het
  // meeste in staat en laten de ander los.
  var perServer = {};
  (KB.G.klassen || []).forEach(function (k) {
    var op = KBSYNC.opServer(k.id);
    if (!op) return;
    var vorige = perServer[op];
    if (!vorige) { perServer[op] = k; return; }
    var telling = function (x) {
      return (x.leerlingen || []).length + (x.hoekLib || []).length + (x.taken || []).length;
    };
    var houden = telling(k) >= telling(vorige) ? k : vorige;
    var los    = houden === k ? vorige : k;
    KBSYNC.koppel(los.id, null);
    perServer[op] = houden;
    gemaakt = true;
  });

  (ik.groepen || []).forEach(function (g) {
    var lokaal = KBSYNC.opLokaal(g.id);
    var bestaat = lokaal && (KB.G.klassen || []).some(function (k) { return k.id === lokaal; });
    if (bestaat) return;
    var k = KB.leegKlas(g.naam);
    /* Dit is een plaatshouder, geen groep. De inhoud staat op de server
       en komt pas hierheen als je hem opent. Tot die tijd mag hij nooit
       de kant van de server op: het verschil zou "deze groep is leeg"
       lezen en de instellingen van je collega overschrijven met de
       standaardwaarden -- of erger. Dit vlaggetje houdt hem tegen; het
       gaat er vanzelf af zodra hij echt is opgehaald. */
    k.magOpnieuwOphalen = true;
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

/* De groepen die bij deze persoon horen. Zodra je bent ingelogd is de
   server de waarheid: alleen groepen die daar staan tellen mee. Groepen
   die alleen in deze browser leven -- van vóór het inloggen, of van een
   collega die hier ooit heeft ingelogd -- horen niet op het bord en niet
   in het beheer. Het schoolbeheer laat ze wel zien, met een knop om ze
   alsnog over te brengen of weg te gooien. */
function mijnKlassen(){
  var alle = (KB.G && KB.G.klassen) || [];
  if (!ik || !ik.profiel) return alle;
  var magBij = {};
  (ik.groepen || []).forEach(function (g) { magBij[g.id] = true; });
  return alle.filter(function (k) {
    var op = KBSYNC.opServer(k.id);
    return op && magBij[op];
  });
}

/* Welke groep hoort bij dit scherm? Een leerkracht heeft er meestal maar
   één; op het digibord is er ooit een gekozen en die onthouden we. */
function kiesGroep(){
  var mijn = mijnKlassen();
  var onthouden = KB.beheerKlasId();
  if (onthouden && mijn.some(function (k) { return k.id === onthouden; })) return onthouden;
  var eerste = mijn[0];
  if (!eerste) return null;
  KB.zetBeheerKlas(eerste.id);
  return eerste.id;
}

/* ── heen en weer ────────────────────────────────────────────────────── */

/* Er mag er maar één tegelijk heen en weer. Vroeger stond dat in een
   simpel ja/nee-vlaggetje, en wie te vroeg kwam kreeg meteen "klaar"
   terug zonder dat er iets gebeurd was. Voor versturen kon dat nog net --
   dan wacht je op de volgende ronde -- maar voor ophalen niet: van groep
   wisselen terwijl er nog iets liep sloeg het ophalen stilletjes over, en
   je keek naar een lege groep met de standaardinstellingen erin.

   Dus houden we niet bij *of* er iets loopt maar *wat* er loopt, zodat
   wie later komt gewoon kan aansluiten. */
var lopend = Promise.resolve();

function stuurNu(){
  if (!klasId || !groepId) return Promise.resolve();
  if (bezig) return lopend.catch(function () {});
  bezig = true;
  meldStand('bezig');
  lopend = KBSYNC.stuurOp(klasId, groepId, ik.profiel.school_id).then(function (uit) {
    bezig = false;
    meldStand(uit.gelukt ? 'klaar' : 'wacht');
    return uit;
  }, function (e) {
    bezig = false;
    meldStand('mis', { fout: e });
    throw e;
  });
  return lopend;
}

/* Zodra er iets is opgeslagen staat er iets klaar om te versturen. Dat
   leggen we meteen vast, niet pas als het versturen mislukt. Anders zou
   ophalen van de server een wijziging kunnen overschrijven die nog in de
   wachtrij stond -- een kind dat net een hoek koos en meteen weer in de
   rij belandt. */
function planOpsturen(){
  if (klasId) KBSYNC.markeerWachtend(klasId, true);
  clearTimeout(timer);
  timer = setTimeout(function () { stuurNu().catch(function () {}); }, WACHT_NA_OPSLAAN);
}

function haalOp(){
  if (!klasId || !groepId) return Promise.resolve();
  // Eerst wat hier klaarstaat wegbrengen; anders overschrijft de server
  // het. Dat geldt ook voor een wijziging die nog op zijn beurt wacht,
  // dus zetten we een eventuele wachttijd meteen stop.
  clearTimeout(timer);
  // Loopt er nog iets? Dan wachten we dat af in plaats van te vertrekken.
  var eerst = lopend.catch(function () {}).then(function () {
    return KBSYNC.wachtErIetsOp(klasId) ? stuurNu().catch(function () {}) : null;
  });
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
    /* Sta je al op het inlogscherm, dan is doorsturen een herlaadlus. */
    if (location.pathname.indexOf('inloggen.html') >= 0) return Promise.resolve({ ingelogd:false });
    location.href = 'inloggen.html';
    return new Promise(function () {});   // we gaan toch weg
  }

  return SB.wieBenIk().then(function (uit) {
    ik = uit;
    /* Doorsturen naar de pagina waar je al staat is geen doorsturen maar
       een herlaadlus: de pagina begint opnieuw, komt tot dezelfde
       conclusie, en stuurt zichzelf weer door -- tientallen keren per
       seconde. Je ziet dan een leeg scherm waar je niets kunt aanklikken,
       en niets wijst erop dat dít het is. Dus: alleen doorsturen als je
       ergens anders naartoe gaat. */
    var hier = function (pagina) { return location.pathname.indexOf(pagina) >= 0; };
    if (!ik.profiel) {
      if (hier('inloggen.html')) return { ingelogd:false };
      location.href = 'inloggen.html';
      return new Promise(function () {});
    }
    if (!ik.profiel.school_id) {
      /* Op het schoolbeheer hoor je te zijn als je nog geen school hebt:
         daar maak je hem aan. */
      if (!hier('school.html')) {
        location.href = 'school.html?nieuw=1';
        return new Promise(function () {});
      }
      return { ingelogd:true, ik:ik, klasId:null, groepId:null, zonderSchool:true };
    }

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

/* Van groep wisselen (het schoolbeheer doet dat).

   Let op de eerste stap. De koppeling tussen een groep hier en dezelfde
   groep op de server wordt bij het inloggen gelegd. Klik je sneller dan
   dat klaar is -- en dat is zo -- dan kende deze functie de groep nog
   niet en riep ze meteen dat hij niet op de server staat. Dat is de
   melding waar in de klas over geklaagd werd, en meestal was hij niet
   waar: de groep stond er wel, we waren alleen te vroeg.

   Dus: eerst even wachten tot de verbinding klaar is, en pas dan
   oordelen. Staat hij er daarna nog steeds niet, dan klopt de melding. */
function naarGroep(nieuwKlasId){
  var klaar = KBSYNC.opServer(nieuwKlasId)
    ? Promise.resolve()
    : zodraKlaar().catch(function () {});
  return klaar.then(function () { return naarGroepNu(nieuwKlasId); });
}

function naarGroepNu(nieuwKlasId){
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
  mijnKlassen: mijnKlassen,
  groepId: function () { return groepId; },
  klasId: function () { return klasId; },
  opStand: function (fn) { luisteraars.push(fn); }
};

})(window);
