/* ══════════════════════════════════════════════════════════════
   KEUZEBORD — GEDEELDE DATALAAG
   Het bord en de beheeromgeving zijn twee aparte apps die hier
   allebei op draaien. Deze laag kent de opslag, de klassen, de
   hoeken en de doelen; hij weet niets van schermen.
   Dezelfde opslagsleutels als de oude app, zodat bestaande
   gegevens gewoon meekomen.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var SLEUTEL      = 'kb_v5';
var DOELEN_KEY   = 'kb_doelen';
var FK_DB        = 'kb_fotokluis', FK_STORE = 'fotos', FK_KEY = 'alles';

var KIND_KLEUREN = ['#3b6ff0','#d94f4f','#2e9e6b','#c8820a','#7c5cbf','#b8436d','#c06428','#1a9aad'];

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* ── opslag ──────────────────────────────────────────────── */
var G = null;

/* Een nieuwe groep begint kaal: alleen kiezen. Alles wat het bord drukker
   maakt zet de leerkracht zelf aan bij Functies. */
function standaardInstellingen(){
  return { timerAan:false, timerMinuten:20, wachtrijAan:false, tellingAan:false,
           werkplaatsAan:false, signaleringAan:false,
           werkmomentenAan:false, werkmomenten:standaardWerkmomenten(),
           bordLegen:'dag', dagdeelUur:12,
           pinAan:false, pincode:'1234', kolommen:3 };
}

/* Op maandag, dinsdag en donderdag wordt er twee keer in de werkplaats
   gewerkt; woensdag en vrijdag maar één keer, want dat zijn halve dagen.
   Dat is de gewoonte hier, en het staat los van hoeveel plekken de
   werkplaats heeft -- twee momenten van zes is twaalf kinderen op een dag. */
function standaardWerkmomenten(){
  return { ma:2, di:2, wo:1, do:2, vr:1 };
}

function werkmomenten(k){
  k = k || klas();
  var uit = standaardWerkmomenten();
  var eigen = instelling('werkmomenten', k);
  if (eigen && typeof eigen === 'object') {
    DAGEN_KORT.forEach(function (d) {
      var n = parseInt(eigen[d], 10);
      if (n >= 1 && n <= 4) uit[d] = n;
    });
  }
  return uit;
}

/* Hoeveel kinderen er op een dag in de werkplaats passen: de plekken maal
   het aantal momenten. Staat de functie uit, dan is het gewoon één ronde. */
function dagRuimte(dag, plekken, k){
  if (!instelling('werkmomentenAan', k)) return plekken;
  return plekken * (werkmomenten(k)[dag] || 1);
}

/* De kinderen van een dag opgedeeld in rondes: de eerste zes zijn moment
   één, de volgende zes moment twee. De volgorde in de verdeling bepaalt
   dus wie wanneer gaat -- en die volgorde kun je zelf verslepen. */
function momentGroepen(wt, dag, plekken, k){
  var lijst = (wt.verdeling && wt.verdeling[dag]) || [];
  var aantal = instelling('werkmomentenAan', k) ? (werkmomenten(k)[dag] || 1) : 1;
  var uit = [];
  for (var m = 0; m < aantal; m++) {
    uit.push(lijst.slice(m * plekken, (m + 1) * plekken));
  }
  // wat er nog overblijft omdat iemand er te veel op deze dag staat
  var rest = lijst.slice(aantal * plekken);
  return { rondes: uit, teveel: rest };
}

/* Wie er vandaag al in de werkplaats is geweest. Zodra een kind zijn
   plaatje er weer uithaalt, is zijn beurt voorbij en schuift de volgende
   ronde in beeld. */
function geweestVandaag(wt, leerlingId){
  return !!(wt && wt.geweest && wt.geweest[leerlingId] === datumSleutel());
}
function markeerGeweest(wt, leerlingId){
  if (!wt) return;
  if (!wt.geweest) wt.geweest = {};
  wt.geweest[leerlingId] = datumSleutel();
}
function datumSleutel(d){
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

function leegKlas(naam){
  var bord = { id:'b'+uid(), naam:'Keuzebord', hoekLibIds:[], plaatsingen:{},
               dagOpen:false, dagGesloten:false, dagStart:null, thema:'geen' };
  return { id:'k'+uid(), naam:naam, borden:[bord], activeBordId:bord.id,
           hoekLib:[], fotoLib:[], leerlingen:[], weekData:[], groepjes:[],
           werkplaatsTaken:[], weekplannerWeken:[], observaties:[],
           wachtrij:[], doelActief:{}, settings:standaardInstellingen() };
}

function laad(){
  try {
    var s = localStorage.getItem(SLEUTEL);
    if (s) { G = JSON.parse(s); }
  } catch (e) { G = null; }
  if (!G || !Array.isArray(G.klassen) || !G.klassen.length) {
    var k = leegKlas('Mijn groep');
    G = { klassen:[k], activeKlasId:k.id, settings:standaardInstellingen() };
  }
  G.klassen.forEach(function (k) {
    if (!k.settings) k.settings = standaardInstellingen();
    if (!k.wachtrij)  k.wachtrij  = [];
    if (!k.doelActief) k.doelActief = {};
    (k.borden || []).forEach(function (b) {
      if (!b.plaatsingen) b.plaatsingen = {};
      if (!b.hoekLibIds)  b.hoekLibIds  = [];
    });
  });
  return G;
}

/* Wie hierop luistert, hoort het zodra er iets is opgeslagen. Zo hoeft
   geen enkele plek in de app zelf te weten dat er ook een server is. */
var naBewaren = null;
function opBewaard(fn){ naBewaren = fn; }

/* Opslaan, en niet omvallen als het niet past.

   localStorage is een kopie, geen archief: alles wat erin staat, staat
   ook op de server, en de foto's staan bovendien in de fotokluis. De
   grens ligt rond de vijf megabyte, en een school met zes volle groepen
   komt daar tegenaan. Vroeger gaf bewaar() dan gewoon `false` terug en
   was het werk van dat moment weg.

   Dus pellen we af, in de volgorde van wat we het makkelijkst missen:

     1. de foto's die al in de kluis liggen
     2. het logboek van groepen waar je nu niet in werkt, voor zover het
        al naar de server is
     3. het oudere logboek van de groep waar je wél in werkt, idem
     4. de hele inhoud van groepen waar je nu niet in werkt -- naam en
        koppeling blijven staan, de rest halen we zo weer op

   Wat nog niet op de server staat raken we niet aan. Liever een volle
   opslag dan werk dat verdwijnt. */
var laatsteAfpelling = 0;

function grensVanLog(klasId){
  // hoever is het logboek van deze groep al naar de server?
  try { return JSON.parse(localStorage.getItem('kb_loggrens') || '{}')[klasId] || 0; }
  catch (e) { return 0; }
}

function bewaar(){
  var trappen = 0;
  while (trappen <= 4) {
    try {
      localStorage.setItem(SLEUTEL, JSON.stringify(uitgedund(trappen)));
      if (trappen > 0) laatsteAfpelling = Date.now();
      if (naBewaren) { try { naBewaren(); } catch (e) {} }
      return true;
    } catch (e) {
      trappen++;
    }
  }
  /* Ook uitgekleed past het niet. Dat kan maar één ding betekenen: er
     staat hier veel dat nog nergens anders staat -- meestal foto's die
     nog niet zijn geüpload. Zodra ze op de server staan mogen ze hier
     weg, dus we vragen om een ronde versturen en melden dat het krap is.
     De aanroeper krijgt `false` en mag het zeggen. */
  laatsteAfpelling = Date.now();
  if (naBewaren) { try { naBewaren(); } catch (e) {} }
  return false;
}

/* De kopie die de deur uit gaat, zo mager als deze trap vraagt. */
function uitgedund(trap){
  var kopie = JSON.parse(JSON.stringify(G));
  var actief = G.activeKlasId;

  kopie.klassen.forEach(function (k) {
    // 0: foto's die al in de kluis liggen horen daar, niet hier
    k.leerlingen.forEach(function (l) { if (l._c) l.image = null; });
    (k.fotoLib || []).forEach(function (f) { if (f._c) f.data = null; });
    if (trap === 0) return;

    var veilig = grensVanLog(k.id);
    var bewaarLog = function (hoeveel) {
      var log = k.gebeurtenissen || [];
      // alleen wat al op de server staat mag weg
      var weg = log.filter(function (g) { return g.tijd <= veilig; });
      var blijft = log.filter(function (g) { return g.tijd > veilig; });
      k.gebeurtenissen = weg.slice(-hoeveel).concat(blijft)
        .sort(function (a, b) { return a.tijd - b.tijd; });
    };

    if (trap >= 1 && k.id !== actief) bewaarLog(0);
    if (trap >= 2) bewaarLog(k.id === actief ? 400 : 0);
    if (trap >= 3 && k.id !== actief) {
      // 3: de hele inhoud van een groep waar je nu niet in werkt. Naam en
      //    id blijven, zodat de koppeling met de server heel blijft; de
      //    rest komt terug zodra je die groep opent.
      k.leerlingen = []; k.hoekLib = []; k.fotoLib = []; k.taken = [];
      k.themas = []; k.weken = {}; k.beoordelingen = {}; k.gebeurtenissen = [];
      k.pictos = []; k.wachtrij = [];
      (k.borden || []).forEach(function (b) { b.plaatsingen = {}; });
      k.magOpnieuwOphalen = true;
    }
    if (trap >= 4 && k.id === actief) {
      // 4: het laatste redmiddel -- ook hier het logboek helemaal weg,
      //    op wat nog niet verstuurd is na.
      bewaarLog(0);
      k.pictos = [];
    }
  });
  return kopie;
}

/* Is er onlangs afgepeld? Dan is dit apparaat krap, en mag een scherm dat
   melden in plaats van te doen alsof er niets aan de hand is. */
function opslagKrap(){
  return laatsteAfpelling > 0 && (Date.now() - laatsteAfpelling) < 36e5;
}

/* Welke groep dit apparaat beheert. Een leerkracht ziet alleen die groep;
   het schoolbeheer kan hem omzetten. */
var BEHEER_KLAS = 'kb_beheer_klas';
function beheerKlasId(){
  try {
    var id = localStorage.getItem(BEHEER_KLAS);
    if (id && G.klassen.some(function (k) { return k.id === id; })) return id;
  } catch (e) {}
  return null;
}
function zetBeheerKlas(id){
  try { if (id) localStorage.setItem(BEHEER_KLAS, id); else localStorage.removeItem(BEHEER_KLAS); }
  catch (e) {}
  if (id) G.activeKlasId = id;
}

/* ── opzoeken ────────────────────────────────────────────── */
function klas(id){
  return G.klassen.filter(function (k) { return k.id === (id || G.activeKlasId); })[0] || G.klassen[0];
}
function bord(k){
  k = k || klas();
  return (k.borden || []).filter(function (b) { return b.id === k.activeBordId; })[0] || k.borden[0];
}
function bordHoeken(b, k){
  k = k || klas(); b = b || bord(k);
  return (b.hoekLibIds || []).map(function (id) {
    return (k.hoekLib || []).filter(function (h) { return h.id === id; })[0];
  }).filter(Boolean);
}
function foto(id, k){
  k = k || klas();
  var f = (k.fotoLib || []).filter(function (x) { return x.id === id; })[0];
  return f ? f.data : null;
}
function leerling(id, k){
  k = k || klas();
  return (k.leerlingen || []).filter(function (l) { return l.id === id; })[0] || null;
}
function instelling(naam, k){
  k = k || klas();
  var s = k.settings || {};
  var std = standaardInstellingen();
  return (naam in s) ? s[naam] : std[naam];
}

/* ── plaatsen op het bord ────────────────────────────────── */
function bezetting(hoekId, b){
  b = b || bord();
  return (b.plaatsingen[hoekId] || []).filter(function (p) {
    var l = leerling(p.leerlingId);
    return l && l.lid !== false;
  });
}
function isVol(hoek, b){ return bezetting(hoek.id, b).length >= hoek.maxKinderen; }

function plaatsingVan(leerlingId, b){
  b = b || bord();
  var hoeken = Object.keys(b.plaatsingen);
  for (var i = 0; i < hoeken.length; i++) {
    var gevonden = (b.plaatsingen[hoeken[i]] || []).filter(function (p) {
      return p.leerlingId === leerlingId;
    })[0];
    if (gevonden) return { hoekId: hoeken[i], plaatsing: gevonden };
  }
  return null;
}

/* Hoeveel milliseconden een kind nog vastzit. 0 = mag wisselen. */
function vergrendeldTot(plaatsing, hoek, k){
  k = k || klas();
  if (!instelling('timerAan', k)) return 0;
  var minuten = (hoek && hoek.timerMinuten) || instelling('timerMinuten', k);
  var eind = (plaatsing.startTijd || 0) + minuten * 60000;
  return Math.max(0, eind - Date.now());
}
function timerDeel(plaatsing, hoek, k){
  k = k || klas();
  if (!instelling('timerAan', k)) return 1;
  var minuten = (hoek && hoek.timerMinuten) || instelling('timerMinuten', k);
  var totaal = minuten * 60000;
  if (totaal <= 0) return 1;
  var verstreken = Date.now() - (plaatsing.startTijd || 0);
  return Math.max(0, Math.min(1, verstreken / totaal));
}

/* Zet een kind in een hoek. Geeft terug wat er gebeurde, zodat de
   schermlaag zelf mag beslissen wat het de klas laat zien. */
function plaats(leerlingId, hoekId){
  var k = klas(), b = bord(k);
  var hoek = (k.hoekLib || []).filter(function (h) { return h.id === hoekId; })[0];
  if (!hoek) return { ok:false, reden:'geen-hoek' };

  var huidig = plaatsingVan(leerlingId, b);
  if (huidig && huidig.hoekId === hoekId) return { ok:false, reden:'zelfde-hoek' };

  if (huidig) {
    var rest = vergrendeldTot(huidig.plaatsing, hoekVan(huidig.hoekId, k), k);
    if (rest > 0) return { ok:false, reden:'vergrendeld', restMs:rest };
  }
  if (isVol(hoek, b)) return { ok:false, reden:'vol', hoek:hoek };

  Object.keys(b.plaatsingen).forEach(function (hid) {
    b.plaatsingen[hid] = (b.plaatsingen[hid] || []).filter(function (p) {
      return p.leerlingId !== leerlingId;
    });
  });
  if (!b.plaatsingen[hoekId]) b.plaatsingen[hoekId] = [];
  b.plaatsingen[hoekId].push({ leerlingId: leerlingId, startTijd: Date.now() });
  uitWachtrij(leerlingId, k);
  logGebeurtenis('gekozen', { leerlingId: leerlingId, hoekId: hoekId }, k);
  bewaar();
  return { ok:true, hoek:hoek };
}

function hoekVan(id, k){
  k = k || klas();
  return (k.hoekLib || []).filter(function (h) { return h.id === id; })[0] || null;
}

/* De juf haalt de wachttijd van dit kind weg. Soms moet een kind eruit
   voordat het rondje vol is -- het gaat mis in de hoek, er moet iemand
   naar de logopedist, of de kring begint. Dan hoort de timer niet in de
   weg te staan.

   We zetten zijn starttijd terug in plaats van er een uitzondering bij
   te bewaren: dan is er maar één plek waar staat hoe lang iemand ergens
   zit, en klopt het rondje op het bord er meteen mee. Alleen dit kind in
   deze hoek verandert; de timer van de rest loopt gewoon door. */
function geefVrij(leerlingId, hoekId, k){
  k = k || klas();
  var b = bord(k);
  var p = (b.plaatsingen[hoekId] || []).filter(function (x) {
    return x.leerlingId === leerlingId;
  })[0];
  if (!p) return false;
  var hoek = hoekVan(hoekId, k);
  var minuten = (hoek && hoek.timerMinuten) || instelling('timerMinuten', k);
  p.startTijd = Date.now() - minuten * 60000 - 1000;
  logGebeurtenis('vrijgegeven', { leerlingId: leerlingId, hoekId: hoekId }, k);
  bewaar();
  return true;
}

function haalWeg(leerlingId, hoekId){
  var k = klas(), b = bord(k);
  var stond = (b.plaatsingen[hoekId] || []).some(function (p) {
    return p.leerlingId === leerlingId;
  });
  b.plaatsingen[hoekId] = (b.plaatsingen[hoekId] || []).filter(function (p) {
    return p.leerlingId !== leerlingId;
  });
  logGebeurtenis('weg', { leerlingId: leerlingId, hoekId: hoekId }, k);

  // Haalt een kind zijn plaatje uit de werkplaats, dan is zijn beurt
  // voorbij en mag de volgende ronde in beeld komen.
  var hoek = hoekVan(hoekId, k);
  if (stond && hoek && hoek.werkplaats) {
    var dag = dagVanVandaag();
    var w = week(weekSleutel(), k);
    (w.taken || []).forEach(function (wt) {
      if ((wt.verdeling[dag] || []).indexOf(leerlingId) >= 0) markeerGeweest(wt, leerlingId);
    });
  }
  bewaar();
  schuifWachtrijDoor(hoekId);
}

/* ── wachtrij ────────────────────────────────────────────── */
function wachtrijVoor(hoekId, k){
  k = k || klas();
  return (k.wachtrij || []).filter(function (w) { return w.hoekId === hoekId; })
    .sort(function (a, b) { return a.sinds - b.sinds; });
}
function inWachtrij(leerlingId, hoekId, k){
  k = k || klas();
  if (!k.wachtrij) k.wachtrij = [];
  uitWachtrij(leerlingId, k);
  k.wachtrij.push({ leerlingId: leerlingId, hoekId: hoekId, sinds: Date.now() });
  bewaar();
  return wachtrijVoor(hoekId, k).map(function (w) { return w.leerlingId; }).indexOf(leerlingId) + 1;
}
function uitWachtrij(leerlingId, k){
  k = k || klas();
  if (!k.wachtrij) { k.wachtrij = []; return; }
  k.wachtrij = k.wachtrij.filter(function (w) { return w.leerlingId !== leerlingId; });
}
function schuifWachtrijDoor(hoekId){
  var k = klas(), hoek = hoekVan(hoekId, k);
  if (!hoek || !instelling('wachtrijAan', k)) return null;
  var rij = wachtrijVoor(hoekId, k);
  if (!rij.length || isVol(hoek)) return null;
  var eerste = rij[0];
  uitWachtrij(eerste.leerlingId, k);
  bewaar();
  return eerste.leerlingId;   // het scherm mag dit vieren
}

/* ── logboek (basis voor statistieken later) ─────────────── */
function logGebeurtenis(soort, gegevens, k){
  k = k || klas();
  if (!k.gebeurtenissen) k.gebeurtenissen = [];
  k.gebeurtenissen.push(Object.assign({ soort: soort, tijd: Date.now() }, gegevens));
  // Ruim op: het logboek mag de opslag niet opeten zolang er geen database is.
  if (k.gebeurtenissen.length > 4000) k.gebeurtenissen = k.gebeurtenissen.slice(-3000);
}

/* ── doelen ──────────────────────────────────────────────── */
var NIVEAUS_PER_GROEP = { 1:['0','1a','1b','1'], 2:['2a','2b','2'], 3:['3a','3b','3'] };
var doelen = { meta:null, lijst:[] };

function doelenLaad(){
  try {
    var s = localStorage.getItem(DOELEN_KEY);
    if (s) { var p = JSON.parse(s); doelen.meta = p.meta || null; doelen.lijst = p.lijst || []; }
  } catch (e) { doelen = { meta:null, lijst:[] }; }
  return doelen;
}
function doelenBewaar(){
  try { localStorage.setItem(DOELEN_KEY, JSON.stringify(doelen)); return true; }
  catch (e) { return false; }
}
/* De doelenlijst hoort er gewoon te zijn. Hij zit als bestand in de app,
   maar stond tot nu toe pas in de browser als iemand hem met de hand had
   ingeladen -- en tot die tijd was er niets te kiezen. Dit haalt hem bij
   het opstarten binnen als hij er nog niet is, één keer. */
function doelenZorg(){
  doelenLaad();
  if (doelen.lijst && doelen.lijst.length) return Promise.resolve(doelen);

  // in de voorvertoning staat de lijst al in de pagina zelf
  try {
    var ingebouwd = document.getElementById('doelen-ingebouwd');
    if (ingebouwd && ingebouwd.textContent) {
      doelenNeemOver(JSON.parse(ingebouwd.textContent));
      if (doelen.lijst.length) return Promise.resolve(doelen);
    }
  } catch (e) {}

  if (typeof fetch !== 'function') return Promise.resolve(doelen);
  return fetch('data/doelen-gouwe-academie.json')
    .then(function (a) { return a.ok ? a.json() : null; })
    .then(function (pak) { if (pak) doelenNeemOver(pak); return doelen; })
    .catch(function () { return doelen; });   // zonder lijst werkt de rest gewoon
}

function doelenNeemOver(pak){
  if (!pak || pak.formaat !== 'keuzebord-doelen' || !Array.isArray(pak.doelen)) return false;
  doelen.meta = { bron: pak.bron || '', versie: pak.versie || 1,
                  niveaus: pak.niveaus || [], domeinen: pak.domeinen || [] };
  doelen.lijst = pak.doelen;
  return doelenBewaar();
}
function klasNiveaus(k){
  k = k || klas();
  if (Array.isArray(k.doelNiveaus) && k.doelNiveaus.length) return k.doelNiveaus;
  // "Groep 1A" en "1/2b" horen allebei bij groep 1 respectievelijk 1 en 2.
  // Een cijfer met een letter erachter telde eerst niet mee, waardoor 1A
  // de niveaus van groep 2 kreeg.
  var m = (k.naam || '').match(/(?:^|[^0-9])([123])(?:[a-dA-D]\b|\b)/);
  return NIVEAUS_PER_GROEP[m ? m[1] : 2] || NIVEAUS_PER_GROEP[2];
}
function doelenVanKlas(k){
  k = k || klas();
  var niveaus = klasNiveaus(k);
  return doelen.lijst.filter(function (d) { return niveaus.indexOf(d.niveau) >= 0; });
}

/* ── fotokluis (blijft op dit apparaat) ──────────────────── */
function fkOpen(){
  return new Promise(function (res, rej) {
    if (!global.indexedDB) { rej(new Error('geen opslag')); return; }
    var req;
    try { req = indexedDB.open(FK_DB, 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = function () { req.result.createObjectStore(FK_STORE); };
    req.onsuccess = function () { res(req.result); };
    req.onerror   = function () { rej(req.error || new Error('opslag niet beschikbaar')); };
  });
}
function fkTx(modus, fn){
  return fkOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var req = fn(db.transaction(FK_STORE, modus).objectStore(FK_STORE));
      req.onsuccess = function () { res(req.result); };
      req.onerror   = function () { rej(req.error); };
    });
  });
}
function fkLees(){  return fkTx('readonly',  function (s) { return s.get(FK_KEY); }); }
function fkBewaar(m){ return fkTx('readwrite', function (s) { return s.put(m, FK_KEY); }); }
function fkWis(){   return fkTx('readwrite', function (s) { return s.delete(FK_KEY); }); }

/* Zet de foto's uit de kluis op de leerlingen en hoekfoto's van elke klas.
   Sleutels: "leerling/<klasnaam>/<naam>", "hoek/<naam>", plus de oude
   vorm "1c/<naam>" en "1d/<naam>" uit de eerste kluisbestanden. */
function fkPasToe(kluis){
  if (!kluis) return 0;
  var n = 0;
  G.klassen.forEach(function (k) {
    (k.leerlingen || []).forEach(function (l) {
      if (l.image && !l._c) return;
      var kandidaten = ['leerling/' + k.naam + '/' + l.naam];
      var m = (k.naam || '').match(/([123][a-dA-D])/);
      if (m) kandidaten.push(m[1].toLowerCase() + '/' + l.naam);
      for (var i = 0; i < kandidaten.length; i++) {
        if (kluis[kandidaten[i]]) { l.image = kluis[kandidaten[i]]; l._c = true; n++; return; }
      }
    });
    (k.fotoLib || []).forEach(function (f) {
      if (f.data) return;
      if (kluis['hoek/' + f.naam]) { f.data = kluis['hoek/' + f.naam]; f._c = true; n++; }
    });
  });
  return n;
}

/* ── afbeeldingen verkleinen ─────────────────────────────── */
/* Hoe groot een foto hoogstens wordt bewaard, in pixels op de langste
   zijde. De verhouding blijft altijd staan. Een foto van 4200x3200 uit een
   telefoon wordt zo zo'n 800x610 -- ongeveer honderd keer kleiner, en op
   een digibord nog altijd scherp. */
var FOTO_MAAT = { leerling:256, hoek:800, archief:640 };
var FOTO_KWALITEIT = { leerling:0.82, hoek:0.7 };

function verklein(file, maxPx, kwaliteit){
  kwaliteit = kwaliteit || 0.82;
  return new Promise(function (res, rej) {
    if (!file) { rej(new Error('geen bestand')); return; }
    if (file.type && file.type.indexOf('image/') !== 0) { rej(new Error('geen afbeelding')); return; }

    function teken(bron, breedte, hoogte){
      try {
        var schaal = Math.min(1, maxPx / Math.max(breedte, hoogte));
        var w = Math.max(1, Math.round(breedte * schaal));
        var h = Math.max(1, Math.round(hoogte  * schaal));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bron, 0, 0, w, h);
        var uit = c.toDataURL('image/webp', kwaliteit);
        if (uit.indexOf('data:image/webp') !== 0) uit = c.toDataURL('image/jpeg', kwaliteit);
        if (bron.close) bron.close();
        res(uit);
      } catch (e) { rej(e); }
    }
    function viaImg(){
      var r = new FileReader();
      r.onload = function (e) {
        var im = new Image();
        im.onload  = function () { teken(im, im.naturalWidth, im.naturalHeight); };
        im.onerror = function () { rej(new Error('kon de afbeelding niet lezen')); };
        im.src = e.target.result;
      };
      r.onerror = function () { rej(new Error('kon het bestand niet lezen')); };
      r.readAsDataURL(file);
    }
    if (global.createImageBitmap) {
      try {
        createImageBitmap(file, { imageOrientation:'from-image' })
          .then(function (bm) { teken(bm, bm.width, bm.height); })
          .catch(viaImg);
        return;
      } catch (e) {}
    }
    viaImg();
  });
}


/* ══════════════════════════════════════════════════════════════
   WERKWIJZE: TAKEN, BEURTEN EN DE WERKPLAATS

   Zo werkt het in de klas:
   elke week staan er een of meer taken klaar die bij een doel horen.
   Alle kinderen komen aan de beurt, verspreid over de week, en worden
   per doel beoordeeld. Ze werken eraan tijdens de speel-werkmomenten,
   in de werkplaats — een hoek op het bord met een beperkt aantal
   plekken. Daarom kent een taak een verdeling: wie doet het op welke
   dag.
   ══════════════════════════════════════════════════════════════ */

var DAGEN_KORT = ['ma','di','wo','do','vr'];
var DAGEN_LANG = { ma:'Maandag', di:'Dinsdag', wo:'Woensdag', do:'Donderdag', vr:'Vrijdag' };
var WERKPLAATS_PLEKKEN = 6;

/* De maandag van de week waarin een datum valt, als "2026-08-24". */
function weekSleutel(datum){
  var d = datum ? new Date(datum) : new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}
function weekVerschoven(sleutel, aantalWeken){
  var d = new Date(sleutel + 'T12:00:00');
  d.setDate(d.getDate() + aantalWeken * 7);
  return weekSleutel(d);
}
function weekLabel(sleutel){
  var d = new Date(sleutel + 'T12:00:00');
  var eind = new Date(d); eind.setDate(eind.getDate() + 4);
  var m = ['januari','februari','maart','april','mei','juni','juli','augustus',
           'september','oktober','november','december'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' t/m ' + eind.getDate() + ' ' + m[eind.getMonth()];
}
/* Het weeknummer zoals de school het gebruikt (ISO): week 1 is de week
   waar 4 januari in valt. Handig om te noemen -- "week 38" zegt een juf
   meer dan "15 september". */
function weekNummer(sleutel){
  var d = new Date(sleutel + 'T12:00:00');
  var don = new Date(d);
  don.setDate(don.getDate() + 3 - ((d.getDay() + 6) % 7));   // de donderdag van deze week
  var eerste = new Date(don.getFullYear(), 0, 4);
  var dagen = Math.round((don - eerste) / 864e5);
  return 1 + Math.floor((dagen + ((eerste.getDay() + 6) % 7)) / 7);
}
/* De vijf schooldagen van deze week als datums. */
function weekDatums(sleutel){
  var d = new Date(sleutel + 'T12:00:00');
  return DAGEN_KORT.map(function (dag, i) {
    var x = new Date(d); x.setDate(x.getDate() + i);
    return { dag:dag, dagNummer:x.getDate(), maand:x.getMonth(),
             sleutel:datumSleutel(x) };
  });
}
function dagVanVandaag(){
  var i = (new Date().getDay() + 6) % 7;
  return i < 5 ? DAGEN_KORT[i] : 'ma';
}

function week(sleutel, k){
  k = k || klas();
  if (!k.weken) k.weken = {};
  sleutel = sleutel || weekSleutel();
  if (!k.weken[sleutel]) k.weken[sleutel] = { centraleDoelIds: [], taken: [] };
  var w = k.weken[sleutel];
  if (!w.centraleDoelIds) w.centraleDoelIds = [];
  if (!w.taken) w.taken = [];
  return w;
}

/* ── taken ───────────────────────────────────────────────── */
function taken(k){ k = k || klas(); if (!k.taken) k.taken = []; return k.taken; }
function taakVan(id, k){
  return taken(k).filter(function (t) { return t.id === id; })[0] || null;
}
function nieuweTaak(gegevens, k){
  k = k || klas();
  var t = {
    id: 't' + uid(),
    naam: gegevens.naam || 'Nieuwe taak',
    omschrijving: gegevens.omschrijving || '',
    doelIds: gegevens.doelIds || [],
    plekken: gegevens.plekken || WERKPLAATS_PLEKKEN,
    kleur: gegevens.kleur || KIND_KLEUREN[taken(k).length % KIND_KLEUREN.length],
    gemaakt: Date.now()
  };
  taken(k).push(t);
  return t;
}

/* ── de werkplaats ───────────────────────────────────────── */
function werkplaatsHoek(k){
  k = k || klas();
  return (k.hoekLib || []).filter(function (h) { return h.werkplaats; })[0] || null;
}
function zorgVoorWerkplaats(k){
  k = k || klas();
  var h = werkplaatsHoek(k);
  if (h) return h;
  h = { id: 'hl' + uid(), naam: 'Werkplaats', maxKinderen: WERKPLAATS_PLEKKEN,
        timerMinuten: 0, fotoId: null, werkplaats: true };
  k.hoekLib.push(h);
  var b = bord(k);
  if ((b.hoekLibIds || []).indexOf(h.id) < 0) b.hoekLibIds.push(h.id);
  if (!b.plaatsingen[h.id]) b.plaatsingen[h.id] = [];
  return h;
}

/* ── beurten: wie doet welke taak op welke dag ───────────── */
/* Alleen kijken of een taak deze week gepland staat, zonder hem aan te
   maken. weekTaak() maakt er namelijk eentje als hij nog niet bestaat, en
   dat is voor lezen precies wat je niet wilt. */
function weekTaakAls(sleutel, taakId, k){
  var w = week(sleutel, k);
  return (w.taken || []).filter(function (x) { return x.taakId === taakId; })[0] || null;
}

function weekTaak(sleutel, taakId, k){
  var w = week(sleutel, k);
  var wt = w.taken.filter(function (x) { return x.taakId === taakId; })[0];
  if (!wt) {
    wt = { taakId: taakId, verdeling: {}, afgerond: {} };
    DAGEN_KORT.forEach(function (d) { wt.verdeling[d] = []; });
    w.taken.push(wt);
  }
  if (!wt.verdeling) { wt.verdeling = {}; DAGEN_KORT.forEach(function (d) { wt.verdeling[d] = []; }); }
  DAGEN_KORT.forEach(function (d) { if (!wt.verdeling[d]) wt.verdeling[d] = []; });
  if (!wt.afgerond) wt.afgerond = {};
  return wt;
}
function haalWeekTaakWeg(sleutel, taakId, k){
  var w = week(sleutel, k);
  w.taken = w.taken.filter(function (x) { return x.taakId !== taakId; });
}

/* Alle kinderen die deze week aan deze taak toegewezen zijn. */
function toegewezen(wt){
  var uit = [];
  DAGEN_KORT.forEach(function (d) {
    (wt.verdeling[d] || []).forEach(function (id) { if (uit.indexOf(id) < 0) uit.push(id); });
  });
  return uit;
}
function dagVanKind(wt, leerlingId){
  for (var i = 0; i < DAGEN_KORT.length; i++) {
    if ((wt.verdeling[DAGEN_KORT[i]] || []).indexOf(leerlingId) >= 0) return DAGEN_KORT[i];
  }
  return null;
}
function zetKindOpDag(sleutel, taakId, leerlingId, dag, k){
  var wt = weekTaak(sleutel, taakId, k);
  DAGEN_KORT.forEach(function (d) {
    wt.verdeling[d] = wt.verdeling[d].filter(function (id) { return id !== leerlingId; });
  });
  if (dag) wt.verdeling[dag].push(leerlingId);
  return wt;
}

/* Hoe vaak een kind eerder aan de beurt was — de basis voor een
   eerlijke verdeling. Telt alle weken mee die al in de groep staan. */
function beurtenTot(sleutel, k){
  k = k || klas();
  var telling = {};
  (k.leerlingen || []).forEach(function (l) { telling[l.id] = { aantal: 0, laatst: 0 }; });
  Object.keys(k.weken || {}).forEach(function (ws) {
    if (ws >= sleutel) return;
    (k.weken[ws].taken || []).forEach(function (wt) {
      toegewezen(wt).forEach(function (id) {
        if (!telling[id]) telling[id] = { aantal: 0, laatst: 0 };
        telling[id].aantal++;
        if (ws > telling[id].laatst) telling[id].laatst = ws;
      });
    });
  });
  return telling;
}

/* Verdeel alle kinderen eerlijk over de dagen van de week.
   Wie het langst niet aan de beurt was, staat vooraan. */
function verdeelAutomatisch(sleutel, taakId, opties, k){
  k = k || klas();
  opties = opties || {};
  var t = taakVan(taakId, k);
  var plekken = (t && t.plekken) || WERKPLAATS_PLEKKEN;
  var dagen = (opties.dagen && opties.dagen.length) ? opties.dagen : DAGEN_KORT.slice();
  var wt = weekTaak(sleutel, taakId, k);

  var telling = beurtenTot(sleutel, k);
  var kinderen = (k.leerlingen || [])
    .filter(function (l) { return l.lid !== false; })
    .slice()
    .sort(function (a, b) {
      var ta = telling[a.id] || { aantal:0, laatst:0 }, tb = telling[b.id] || { aantal:0, laatst:0 };
      if (ta.aantal !== tb.aantal) return ta.aantal - tb.aantal;       // minst aan de beurt eerst
      if (ta.laatst !== tb.laatst) return ta.laatst < tb.laatst ? -1 : 1; // langst geleden eerst
      return (a.naam || '').localeCompare(b.naam || '');
    });

  dagen.forEach(function (d) { wt.verdeling[d] = []; });
  DAGEN_KORT.forEach(function (d) { if (dagen.indexOf(d) < 0) wt.verdeling[d] = wt.verdeling[d] || []; });

  // Hoeveel er op elke dag past. Op een dag met twee werkmomenten passen er
  // twee rondes, op een halve dag maar één.
  var ruimte = {};
  var totaleRuimte = 0;
  dagen.forEach(function (d) { ruimte[d] = dagRuimte(d, plekken, k); totaleRuimte += ruimte[d]; });

  // Zo gelijk mogelijk verdelen, maar naar rato van wat er per dag past:
  // een dag met twee momenten krijgt er ongeveer twee keer zoveel.
  var i = 0;
  var wens = {};
  dagen.forEach(function (d) {
    wens[d] = Math.min(ruimte[d],
      Math.round(kinderen.length * (ruimte[d] / (totaleRuimte || 1))));
  });
  dagen.forEach(function (d) {
    for (var n = 0; n < wens[d] && i < kinderen.length; n++) {
      wt.verdeling[d].push(kinderen[i++].id);
    }
  });
  // Wat overblijft: aanvullen waar nog ruimte is.
  while (i < kinderen.length) {
    var geplaatst = false;
    for (var j = 0; j < dagen.length && i < kinderen.length; j++) {
      if (wt.verdeling[dagen[j]].length < ruimte[dagen[j]]) {
        wt.verdeling[dagen[j]].push(kinderen[i++].id);
        geplaatst = true;
      }
    }
    if (!geplaatst) break;   // echt geen ruimte meer deze week
  }
  return { wt: wt, nietGeplaatst: kinderen.slice(i).map(function (l) { return l.id; }) };
}

/* Wie staat er vandaag in de werkplaats? */
function geplandVandaag(sleutel, dag, k){
  k = k || klas();
  sleutel = sleutel || weekSleutel();
  dag = dag || dagVanVandaag();
  var w = week(sleutel, k);
  var uit = [];
  w.taken.forEach(function (wt) {
    (wt.verdeling[dag] || []).forEach(function (id) {
      uit.push({ leerlingId: id, taakId: wt.taakId });
    });
  });
  return uit;
}
function heeftBeurtVandaag(leerlingId, k){
  return geplandVandaag(null, null, k).some(function (x) { return x.leerlingId === leerlingId; });
}

/* ── beoordelen ────────────────────────────────────────────
   Drie gradaties, in de woorden waarin je het over een kleuter
   hebt. Een kind dat iets nog niet kan is niet "niets" -- het is
   aan het ontdekken, en dat is de eerste trede.

   De sleutels eronder ('nog', 'bezig', 'behaald') blijven staan.
   Ze zitten in de database, in de synchronisatie en in ieders
   bestaande observaties; alleen de woorden erboven veranderen. */
/* Welke versie van de app draait hier. Staat onder in het bordmenu en
   bij Groep, zodat je kunt zien of je de nieuwe versie al voor je hebt
   of nog naar de oude uit de cache van je browser kijkt. */
var VERSIE = '28 augustus 2026';

var STANDEN = ['nog', 'bezig', 'behaald'];
var STAND_NAAM = {
  nog:     'is aan het ontdekken',
  bezig:   'kan het met hulp',
  behaald: 'kan het zelfstandig'
};
var STAND_KORT = { nog:'ontdekken', bezig:'met hulp', behaald:'zelfstandig' };
function standNaam(stand){ return STAND_NAAM[stand] || STAND_NAAM.nog; }
function standKort(stand){ return STAND_KORT[stand] || STAND_KORT.nog; }

function beoordelingen(k){ k = k || klas(); if (!k.beoordelingen) k.beoordelingen = {}; return k.beoordelingen; }
function beoordelingSleutel(leerlingId, doelId){ return leerlingId + '|' + doelId; }
function standVan(leerlingId, doelId, k){
  var b = beoordelingen(k)[beoordelingSleutel(leerlingId, doelId)];
  return b ? b.stand : 'nog';
}
/* Is hier ooit naar gekeken? Dat is iets anders dan de eerste trede:
   "nog niet bekeken" en "is aan het ontdekken" zien er op het scherm
   hetzelfde uit, maar in een verslag wil je ze uit elkaar houden. */
function isBeoordeeld(leerlingId, doelId, k){
  return !!beoordelingen(k)[beoordelingSleutel(leerlingId, doelId)];
}
function zetStand(leerlingId, doelId, stand, taakId, k){
  k = k || klas();
  var sleutel = beoordelingSleutel(leerlingId, doelId);
  if (STANDEN.indexOf(stand) < 0) { delete beoordelingen(k)[sleutel]; return; }
  beoordelingen(k)[sleutel] = { stand: stand, taakId: taakId || null, datum: Date.now() };
}
function wisStand(leerlingId, doelId, k){
  delete beoordelingen(k || klas())[beoordelingSleutel(leerlingId, doelId)];
}
function volgendeStand(huidig){
  var i = STANDEN.indexOf(huidig);
  return STANDEN[(i + 1) % STANDEN.length];
}

/* ── thema's ───────────────────────────────────────────────
   Thematisch onderzoekend leren, zoals Tessel van der Linde het voor
   kleuters beschrijft, loopt langs vier bewegingen. Wij houden die
   volgorde aan, want het is precies de volgorde waarin een juf een thema
   voorbereidt:

     1. Verwonderen   iets wat de kinderen raakt: een startactiviteit,
                      een voorwerp, een verhaal. Wat weten we al?
     2. Vragen        wat willen we weten? De vragen komen van de
                      kinderen; jij vangt ze op en hangt ze op.
     3. Onderzoeken   spelen en uitzoeken: de hoeken die je erop
                      inricht, de activiteiten die je doet, de taken in
                      de werkplaats, en de doelen waar je aan werkt.
     4. Betekenis     wat hebben we ontdekt, en aan wie laten we het
                      zien. De afsluiting.

   Een thema is iets wat je vooruit uitwerkt en later inplant. Daarom
   staat hier geen datum verplicht: je maakt hem klaar, en pas als je
   hem in een week hangt gaat hij lopen. */

var ACTIVITEITSOORTEN = [
  { id:'kring',   naam:'In de kring' },
  { id:'klein',   naam:'Klein groepje' },
  { id:'hoek',    naam:'In een hoek' },
  { id:'buiten',  naam:'Buiten' },
  { id:'uitstap', naam:'Uitstapje of bezoek' }
];

function themas(k){ k = k || klas(); if (!k.themas) k.themas = []; return k.themas; }
function themaVan(id, k){
  if (!id) return null;
  return themas(k).filter(function (t) { return t.id === id; })[0] || null;
}
function nieuwThema(gegevens, k){
  k = k || klas();
  gegevens = gegevens || {};
  var t = {
    id: 'th' + uid(),
    naam: gegevens.naam || 'Nieuw thema',
    vraag: gegevens.vraag || '',
    start: gegevens.start || '',
    afsluiting: gegevens.afsluiting || '',
    van: gegevens.van || null,
    tot: gegevens.tot || null,
    vragen: [],
    activiteiten: [],
    doelIds: [],
    hoekIds: [],
    kleur: gegevens.kleur || HOEKKLEUREN[themas(k).length % HOEKKLEUREN.length],
    archief: false,
    gemaakt: Date.now()
  };
  themas(k).push(t);
  return t;
}
function haalThemaWeg(id, k){
  k = k || klas();
  k.themas = themas(k).filter(function (t) { return t.id !== id; });
  // wat eraan hing blijft bestaan, maar hangt er niet meer aan
  taken(k).forEach(function (x) { if (x.themaId === id) x.themaId = null; });
  Object.keys(k.weken || {}).forEach(function (w) {
    if (k.weken[w].themaId === id) k.weken[w].themaId = null;
  });
}

/* De taken die bij een thema horen. Eén kant vastleggen is genoeg: de
   taak weet bij welk thema hij hoort, de rest leiden we af. */
function takenVanThema(themaId, k){
  return taken(k).filter(function (t) { return t.themaId === themaId; });
}
function hoekenVanThema(thema, k){
  k = k || klas();
  return ((thema && thema.hoekIds) || [])
    .map(function (id) { return hoekVan(id, k); })
    .filter(Boolean);
}

/* Het thema van een week. Staat er niets, dan kijken we of er een thema
   is dat deze week omvat -- je hebt hem dan wel uitgewerkt met een
   periode erbij, maar nog niet aan de week gehangen. */
function themaVanWeek(sleutel, k){
  k = k || klas();
  var w = week(sleutel, k);
  if (w.themaId) {
    var gekozen = themaVan(w.themaId, k);
    if (gekozen) return gekozen;
  }
  return themas(k).filter(function (t) {
    return !t.archief && t.van && t.tot && sleutel >= t.van && sleutel <= t.tot;
  })[0] || null;
}

/* Hoeveel staat er al? Genoeg om in één oogopslag te zien of een thema
   klaar is om te draaien. */
function themaStand(t, k){
  k = k || klas();
  var vragen = (t.vragen || []).length;
  return {
    vragen: vragen,
    beantwoord: (t.vragen || []).filter(function (v) { return v.beantwoord; }).length,
    doelen: (t.doelIds || []).length,
    activiteiten: (t.activiteiten || []).length,
    gedaan: (t.activiteiten || []).filter(function (a) { return a.gedaan; }).length,
    taken: takenVanThema(t.id, k).length,
    hoeken: (t.hoekIds || []).length,
    heeftStart: !!(t.start || '').trim(),
    heeftAfsluiting: !!(t.afsluiting || '').trim()
  };
}

/* ── waar een hoek voor is ─────────────────────────────────
   Een bouwhoek is niet zomaar een hoek: daar zit grove motoriek in, en
   meetkunde. Een kralenplank is fijne motoriek. Als je dat vastlegt kun
   je zien of je aanbod nog in balans is -- of dat er vier hoeken staan
   die allemaal hetzelfde vragen.

   De indeling is niet verzonnen: het zijn precies de domeinen en
   leerlijnen van de doelenlijst waar je ook je doelen uit kiest. Zo
   praten hoeken en doelen dezelfde taal. */

var LEERLIJNEN = [
  { domein:'Spel',               leerlijn:'Spel' },
  { domein:'Taal',               leerlijn:'Geletterdheid' },
  { domein:'Taal',               leerlijn:'Mondelinge taal' },
  { domein:'Taal',               leerlijn:'Spelling/schrijven' },
  { domein:'Rekenen',            leerlijn:'Tellen en getalbegrip' },
  { domein:'Rekenen',            leerlijn:'Meten' },
  { domein:'Rekenen',            leerlijn:'Meetkunde' },
  { domein:'Motoriek',           leerlijn:'Grove motoriek' },
  { domein:'Motoriek',           leerlijn:'Fijne motoriek' },
  { domein:'Sociaal-emotioneel', leerlijn:'Welbevinden' },
  { domein:'Sociaal-emotioneel', leerlijn:'Besef van zichzelf' },
  { domein:'Sociaal-emotioneel', leerlijn:'Omgaan met zichzelf' },
  { domein:'Sociaal-emotioneel', leerlijn:'Besef van de ander' },
  { domein:'Sociaal-emotioneel', leerlijn:'Omgaan met de ander' },
  { domein:'Sociaal-emotioneel', leerlijn:'Keuzes maken' }
];
var DOMEINEN = ['Spel','Taal','Rekenen','Motoriek','Sociaal-emotioneel'];

/* De leerlijn is de sleutel; de naam is uniek over alle domeinen heen. */
function domeinVanLeerlijn(leerlijn){
  var r = LEERLIJNEN.filter(function (x) { return x.leerlijn === leerlijn; })[0];
  return r ? r.domein : null;
}
function leerlijnenPerDomein(){
  var uit = {};
  DOMEINEN.forEach(function (d) { uit[d] = []; });
  LEERLIJNEN.forEach(function (x) { uit[x.domein].push(x.leerlijn); });
  return uit;
}

function hoekLeerlijnen(h){
  return (h && Array.isArray(h.leerlijnen)) ? h.leerlijnen.filter(domeinVanLeerlijn) : [];
}
function hoekDomeinen(h){
  var uit = [];
  hoekLeerlijnen(h).forEach(function (l) {
    var d = domeinVanLeerlijn(l);
    if (d && uit.indexOf(d) < 0) uit.push(d);
  });
  return uit.sort(function (a, b) { return DOMEINEN.indexOf(a) - DOMEINEN.indexOf(b); });
}

/* Een hoek die "bouwhoek" heet vraagt bijna zeker om grove motoriek en
   meetkunde. Dat hoeft niemand vijftien keer in te tikken, dus doen we
   een voorstel op de naam. Het blijft een voorstel: je kunt alles
   aanvinken en uitvinken. */
var HOEKWOORDEN = [
  [/bouw|blok|duplo|lego|kapla/,            ['Grove motoriek','Meetkunde','Spel']],
  [/huis|pop|keuken|winkel|restaurant|kapper|dokter|ziekenhuis|rollen/,
                                            ['Spel','Mondelinge taal','Omgaan met de ander']],
  [/lees|boek|verhaal|luister/,             ['Geletterdheid','Mondelinge taal']],
  [/schrijf|letter|stempel/,                ['Spelling/schrijven','Geletterdheid','Fijne motoriek']],
  [/kraal|kralenplank|rijg|prik|knip|vouw|weef|borduur|mozaiek|mozaïek/,
                                            ['Fijne motoriek','Meetkunde']],
  [/puzzel/,                                ['Meetkunde','Fijne motoriek']],
  [/reken|getal|tel|cijfer/,                ['Tellen en getalbegrip']],
  [/meet|weeg|weeg|balans|liniaal/,         ['Meten']],
  [/zand|water|modder/,                     ['Meten','Spel','Grove motoriek']],
  [/verf|teken|kleur|schilder|klei|knutsel|creatief|atelier/,
                                            ['Fijne motoriek','Spel']],
  [/timmer|zaag|hamer|techniek/,            ['Grove motoriek','Fijne motoriek','Meten']],
  [/ontdek|onderzoek|natuur|proef/,         ['Meten','Mondelinge taal','Besef van zichzelf']],
  [/muziek|dans|zing|ritme/,                ['Grove motoriek','Welbevinden']],
  [/buiten|gym|klim|fiets|bewegen|speelplaats/,
                                            ['Grove motoriek','Welbevinden','Omgaan met de ander']],
  [/computer|tablet|ipad|digi/,             ['Fijne motoriek','Geletterdheid']],
  [/thema/,                                 ['Spel','Mondelinge taal']],
  [/werkplaats|werk|taak/,                  ['Fijne motoriek','Keuzes maken']],
  [/stil|rust|alleen/,                      ['Welbevinden','Omgaan met zichzelf']]
];

function stelLeerlijnenVoor(naam){
  var n = String(naam || '').toLowerCase();
  var uit = [];
  HOEKWOORDEN.forEach(function (paar) {
    if (!paar[0].test(n)) return;
    paar[1].forEach(function (l) { if (uit.indexOf(l) < 0) uit.push(l); });
  });
  return uit;
}

/* Waar zit een gat? Welke leerlijnen komen in geen enkele hoek op het
   bord terug. Dat is geen fout -- niet alles hoort in een hoek -- maar
   het is wel iets om even naar te kijken. */
function dekkingVanHoeken(k, b){
  k = k || klas();
  var hoeken = b ? bordHoeken(b, k) : (k.hoekLib || []);
  var geteld = {};
  hoeken.filter(Boolean).forEach(function (h) {
    hoekLeerlijnen(h).forEach(function (l) { geteld[l] = (geteld[l] || 0) + 1; });
  });
  return LEERLIJNEN.map(function (x) {
    return { domein:x.domein, leerlijn:x.leerlijn, hoeken: geteld[x.leerlijn] || 0 };
  });
}

/* ── picto-bibliotheek per groep ─────────────────────────── */
function pictos(k){ k = k || klas(); if (!k.pictos) k.pictos = []; return k.pictos; }
function voegPictoToe(naam, data, k){
  var p = { id: 'p' + uid(), naam: naam || 'Picto', data: data, gemaakt: Date.now() };
  pictos(k).push(p);
  return p;
}
function pictoVan(id, k){
  return pictos(k).filter(function (p) { return p.id === id; })[0] || null;
}
function koppelPicto(leerlingId, pictoId, k){
  k = k || klas();
  var l = leerling(leerlingId, k), p = pictoVan(pictoId, k);
  if (!l || !p) return false;
  l.image = p.data; l.pictoId = p.id; l._c = false;
  return true;
}


/* ══════════════════════════════════════════════════════════════
   BACK-UP
   Zolang alles in de browser staat, is een back-up het enige
   vangnet. Een back-up bevat alles: groepen, kinderen, planning,
   doelen, observaties en de foto's uit de fotokluis.

   Zo'n bestand reist mee naar een USB-stick of een mailbox, dus
   het kan met een wachtwoord versleuteld worden (AES-GCM 256 met
   PBKDF2). Kwijt is dan wel kwijt.
   ══════════════════════════════════════════════════════════════ */
var BACKUP_TIJD = 'kb_laatste_backup';

function laatsteBackup(){
  try { return parseInt(localStorage.getItem(BACKUP_TIJD), 10) || 0; }
  catch (e) { return 0; }
}
function noteerBackup(){
  try { localStorage.setItem(BACKUP_TIJD, String(Date.now())); } catch (e) {}
}
function dagenSindsBackup(){
  var t = laatsteBackup();
  if (!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function maakBackup(){
  return fkLees().catch(function () { return null; }).then(function (kluis) {
    return {
      formaat: 'keuzebord-backup',
      versie: 1,
      gemaakt: new Date().toISOString(),
      groepen: (G.klassen || []).length,
      gegevens: G,
      doelen: doelen,
      fotos: kluis || {}
    };
  });
}

function zetBackupTerug(pak){
  if (!pak || pak.formaat !== 'keuzebord-backup' || !pak.gegevens) {
    return Promise.reject(new Error('dit is geen back-upbestand'));
  }
  G = pak.gegevens;
  if (!G.klassen || !G.klassen.length) return Promise.reject(new Error('de back-up bevat geen groepen'));
  if (pak.doelen && pak.doelen.lijst) {
    doelen.meta = pak.doelen.meta || null;
    doelen.lijst = pak.doelen.lijst || [];
    doelenBewaar();
  }
  bewaar();
  var fotos = pak.fotos || {};
  if (!Object.keys(fotos).length) return Promise.resolve(0);
  return fkBewaar(fotos).then(function () {
    return fkPasToe(fotos);
  }).then(function (n) { bewaar(); return n; })
    .catch(function () { return 0; });   // zonder foto's werkt de rest gewoon
}

/* ── versleutelen ────────────────────────────────────────── */
function cryptoKan(){ return !!(global.crypto && global.crypto.subtle && global.isSecureContext); }
function b64van(buf){
  var a = new Uint8Array(buf), s = '';
  for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}
function b64naar(s){
  var b = atob(s), a = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
function sleutelUit(wachtwoord, salt){
  return crypto.subtle.importKey('raw', new TextEncoder().encode(wachtwoord), 'PBKDF2', false, ['deriveKey'])
    .then(function (km) {
      return crypto.subtle.deriveKey(
        { name:'PBKDF2', salt:salt, iterations:250000, hash:'SHA-256' },
        km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
    });
}
function versleutel(tekst, wachtwoord){
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv   = crypto.getRandomValues(new Uint8Array(12));
  return sleutelUit(wachtwoord, salt).then(function (key) {
    return crypto.subtle.encrypt({ name:'AES-GCM', iv:iv }, key, new TextEncoder().encode(tekst));
  }).then(function (ct) {
    return { formaat:'keuzebord-backup', versie:1, versleuteld:true,
             algoritme:'AES-GCM-256 / PBKDF2-SHA256-250000',
             salt:b64van(salt), iv:b64van(iv), data:b64van(ct) };
  });
}
function ontsleutel(pak, wachtwoord){
  return sleutelUit(wachtwoord, b64naar(pak.salt)).then(function (key) {
    return crypto.subtle.decrypt({ name:'AES-GCM', iv:b64naar(pak.iv) }, key, b64naar(pak.data));
  }).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
}

/* Zet een back-up klaar als bestand. Geeft de grootte in KB terug. */
function downloadBackup(wachtwoord){
  return maakBackup().then(function (pak) {
    if (!wachtwoord) return pak;
    if (!cryptoKan()) throw new Error('versleutelen kan alleen via een https-adres');
    return versleutel(JSON.stringify(pak), wachtwoord);
  }).then(function (pak) {
    var tekst = JSON.stringify(pak);
    var datum = new Date().toISOString().slice(0, 10);
    var naam = 'keuzebord-backup-' + datum + (wachtwoord ? '-versleuteld' : '') + '.json';
    var blob = new Blob([tekst], { type:'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = naam;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    noteerBackup();
    return { naam: naam, kb: Math.round(tekst.length / 1024) };
  });
}

/* Leest een back-upbestand. vraagWachtwoord wordt aangeroepen als het
   bestand versleuteld is en moet een Promise met het wachtwoord geven. */
function leesBackupBestand(file, vraagWachtwoord){
  return new Promise(function (res, rej) {
    var r = new FileReader();
    r.onload = function (e) {
      var pak;
      try { pak = JSON.parse(e.target.result); }
      catch (err) { rej(new Error('onleesbaar bestand')); return; }
      if (!pak || pak.formaat !== 'keuzebord-backup') { rej(new Error('dit is geen back-upbestand')); return; }
      if (!pak.versleuteld) { res(pak); return; }
      if (!cryptoKan()) { rej(new Error('versleutelde bestanden vragen een https-adres')); return; }
      Promise.resolve(vraagWachtwoord()).then(function (ww) {
        if (!ww) { rej(new Error('geen wachtwoord ingevuld')); return; }
        ontsleutel(pak, ww).then(res).catch(function () {
          rej(new Error('wachtwoord klopt niet, of het bestand is beschadigd'));
        });
      });
    };
    r.onerror = function () { rej(new Error('kon het bestand niet lezen')); };
    r.readAsText(file);
  });
}


/* ══════════════════════════════════════════════════════════════
   UITERLIJK VAN HET BORD
   Een groep kiest zelf hoe het bord eruitziet: een kant-en-klare
   sfeer, een eigen kleur, of een foto als achtergrond. Die foto
   wordt bij het inladen op maat gemaakt voor een breed scherm, en
   krijgt een sluier zodat de picto's leesbaar blijven.
   ══════════════════════════════════════════════════════════════ */
var SFEREN = [
  { id:'warm',   naam:'Warm',      grond:'#fbf8f4',
    vlekken:[['#ffeede','8% -12%'],['#e2f0fb','96% 4%'],['#eaf6ec','42% 110%']] },
  { id:'koel',   naam:'Koel',      grond:'#f5f8fb',
    vlekken:[['#e3edfa','10% -10%'],['#e6f4f6','92% 6%'],['#eef0fa','50% 108%']] },
  { id:'lente',  naam:'Lente',     grond:'#f7fbf6',
    vlekken:[['#e6f6e2','12% -12%'],['#fdf6dd','88% 2%'],['#e3f3f7','46% 108%']] },
  { id:'herfst', naam:'Herfst',    grond:'#fdf7f1',
    vlekken:[['#fbe6cd','10% -12%'],['#f9dfd4','90% 4%'],['#f3ecd9','44% 110%']] },
  { id:'winter', naam:'Winter',    grond:'#f6f9fc',
    vlekken:[['#e4eef8','8% -10%'],['#eef1f7','94% 6%'],['#e9f3f6','48% 108%']] },
  { id:'rustig', naam:'Heel rustig', grond:'#f7f7f8', vlekken:[] }
];

function sfeerVan(id){
  return SFEREN.filter(function (s) { return s.id === id; })[0] || SFEREN[0];
}

function uiterlijk(k){
  k = k || klas();
  if (!k.uiterlijk) k.uiterlijk = { soort:'sfeer', sfeer:'warm', kleur:'#fbf8f4',
                                    foto:null, sluier:0.4 };
  return k.uiterlijk;
}

/* De css-achtergrond die bij de instelling hoort. */
function achtergrondCss(k){
  var u = uiterlijk(k);
  if (u.soort === 'foto' && u.foto) {
    var sluier = Math.max(0, Math.min(0.85, u.sluier == null ? 0.4 : u.sluier));
    return 'linear-gradient(rgba(255,255,255,' + sluier + '), rgba(255,255,255,' + sluier + ')), ' +
           'url(' + u.foto + ') center / cover no-repeat fixed';
  }
  if (u.soort === 'kleur') return u.kleur || '#f7f7f8';
  var s = sfeerVan(u.sfeer);
  var delen = s.vlekken.map(function (v) {
    return 'radial-gradient(1000px 600px at ' + v[1] + ', ' + v[0] + ' 0%, transparent 60%)';
  });
  delen.push(s.grond);
  return delen.join(', ');
}

/* Maakt een geüploade foto passend voor een breed schoolbord: bijsnijden
   naar 16:9 en verkleinen, zodat hij scherp blijft maar klein van omvang. */
function achtergrondUitBestand(file){
  return new Promise(function (res, rej) {
    if (!file || (file.type && file.type.indexOf('image/') !== 0)) {
      rej(new Error('geen afbeelding')); return;
    }
    var doelB = 1920, doelH = 1080;
    function teken(bron, breedte, hoogte){
      try {
        var c = document.createElement('canvas');
        c.width = doelB; c.height = doelH;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        // vullen en bijsnijden: de foto raakt beide randen, niets wordt uitgerekt
        var schaal = Math.max(doelB / breedte, doelH / hoogte);
        var b = breedte * schaal, h = hoogte * schaal;
        ctx.drawImage(bron, (doelB - b) / 2, (doelH - h) / 2, b, h);
        var uit = c.toDataURL('image/webp', 0.78);
        if (uit.indexOf('data:image/webp') !== 0) uit = c.toDataURL('image/jpeg', 0.78);
        if (bron.close) bron.close();
        res(uit);
      } catch (e) { rej(e); }
    }
    function viaImg(){
      var r = new FileReader();
      r.onload = function (e) {
        var im = new Image();
        im.onload = function () { teken(im, im.naturalWidth, im.naturalHeight); };
        im.onerror = function () { rej(new Error('kon de afbeelding niet lezen')); };
        im.src = e.target.result;
      };
      r.onerror = function () { rej(new Error('kon het bestand niet lezen')); };
      r.readAsDataURL(file);
    }
    if (global.createImageBitmap) {
      try {
        createImageBitmap(file, { imageOrientation:'from-image' })
          .then(function (bm) { teken(bm, bm.width, bm.height); })
          .catch(viaImg);
        return;
      } catch (e) {}
    }
    viaImg();
  });
}


/* ══════════════════════════════════════════════════════════════
   HET BORD LEEGMAKEN
   Elke groep doet dit anders: sommige beginnen elke ochtend blanco,
   andere na elk speel-werkmoment, en weer andere ruimen zelf op.
   Wat er gekozen was gaat eerst het logboek in, zodat de statistiek
   later kan laten zien wie waar speelde.
   ══════════════════════════════════════════════════════════════ */
function legenGrens(k){
  k = k || klas();
  var soort = instelling('bordLegen', k);
  if (soort === 'nooit') return null;
  var nu = new Date();
  var grens = new Date(nu); grens.setHours(0, 0, 0, 0);
  if (soort === 'dagdeel') {
    var uur = instelling('dagdeelUur', k) || 12;
    if (nu.getHours() >= uur) grens.setHours(uur, 0, 0, 0);
  }
  return grens.getTime();
}

function moetLegen(k){
  k = k || klas();
  var grens = legenGrens(k);
  if (grens === null) return false;
  var b = bord(k);
  var laatst = b.laatstGeleegd || 0;
  if (laatst >= grens) return false;
  // Niets op het bord? Dan valt er ook niets op te ruimen; wel bijwerken.
  var iemand = Object.keys(b.plaatsingen || {}).some(function (h) {
    return (b.plaatsingen[h] || []).length;
  });
  if (!iemand) { b.laatstGeleegd = Date.now(); bewaar(); return false; }
  return true;
}

function leegBord(k){
  k = k || klas();
  var b = bord(k);
  var aantal = 0;
  Object.keys(b.plaatsingen || {}).forEach(function (hoekId) {
    (b.plaatsingen[hoekId] || []).forEach(function (p) {
      logGebeurtenis('opgeruimd', {
        leerlingId: p.leerlingId, hoekId: hoekId,
        minuten: Math.round((Date.now() - (p.startTijd || Date.now())) / 60000)
      }, k);
      aantal++;
    });
    b.plaatsingen[hoekId] = [];
  });
  k.wachtrij = [];
  b.laatstGeleegd = Date.now();
  bewaar();
  return aantal;
}


/* ══════════════════════════════════════════════════════════════
   KLEUREN VAN EEN HOEK
   Een hoek heeft één kleur. Daar leiden we de tinten van af, zodat
   de leerkracht alleen die ene kleur hoeft te kiezen en de kaart
   toch klopt: sterk in het beeldvlak, zacht eronder.
   ══════════════════════════════════════════════════════════════ */
var HOEKKLEUREN = ['#3b6ff0','#e2607f','#e79a1f','#8b6ad0','#17a9bd',
                   '#37ab74','#e8674f','#c9772f','#6b7fd7','#d4589b'];

function hexNaarRgb(hex){
  hex = (hex || '').replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var n = parseInt(hex, 16);
  if (isNaN(n)) return [59, 111, 240];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mengMetWit(hex, deel){
  var c = hexNaarRgb(hex);
  return 'rgb(' + c.map(function (x) {
    return Math.round(x + (255 - x) * deel);
  }).join(',') + ')';
}
function metDoorzicht(hex, alfa){
  return 'rgba(' + hexNaarRgb(hex).join(',') + ',' + alfa + ')';
}
/* Donkerder maken voor tekst, zodat de naam op een zachte kaart leesbaar blijft. */
function donkerder(hex, deel){
  var c = hexNaarRgb(hex);
  return 'rgb(' + c.map(function (x) { return Math.round(x * (1 - deel)); }).join(',') + ')';
}

function hoekKleur(hoek, index){
  if (hoek && hoek.kleur) return hoek.kleur;
  return HOEKKLEUREN[(index || 0) % HOEKKLEUREN.length];
}
function hoekTinten(hoek, index){
  var kleur = hoekKleur(hoek, index);
  return {
    kleur: kleur,
    tekst: donkerder(kleur, 0.28),
    tint:  mengMetWit(kleur, 0.82),
    zacht: mengMetWit(kleur, 0.94),
    schaduw: metDoorzicht(kleur, 0.2)
  };
}

/* ── naar buiten ─────────────────────────────────────────── */
global.KB = {
  KIND_KLEUREN: KIND_KLEUREN,
  FOTO_MAAT: FOTO_MAAT, FOTO_KWALITEIT: FOTO_KWALITEIT,
  NIVEAUS_PER_GROEP: NIVEAUS_PER_GROEP,
  uid: uid,
  get G(){ return G; },
  laad: laad, bewaar: bewaar, opBewaard: opBewaard, opslagKrap: opslagKrap, leegKlas: leegKlas, standaardInstellingen: standaardInstellingen,
  klas: klas, bord: bord, bordHoeken: bordHoeken, foto: foto, leerling: leerling,
  hoekVan: hoekVan, instelling: instelling,
  bezetting: bezetting, isVol: isVol, plaatsingVan: plaatsingVan,
  VERSIE: VERSIE,
  geefVrij: geefVrij,
  vergrendeldTot: vergrendeldTot, timerDeel: timerDeel,
  plaats: plaats, haalWeg: haalWeg,
  wachtrijVoor: wachtrijVoor, inWachtrij: inWachtrij, uitWachtrij: uitWachtrij,
  schuifWachtrijDoor: schuifWachtrijDoor,
  logGebeurtenis: logGebeurtenis,
  doelen: doelen, doelenLaad: doelenLaad, doelenZorg: doelenZorg,
  doelenNeemOver: doelenNeemOver,
  doelenBewaar: doelenBewaar, klasNiveaus: klasNiveaus, doelenVanKlas: doelenVanKlas,
  fkLees: fkLees, fkBewaar: fkBewaar, fkWis: fkWis, fkPasToe: fkPasToe,
  verklein: verklein,
  beheerKlasId: beheerKlasId, zetBeheerKlas: zetBeheerKlas,
  laatsteBackup: laatsteBackup, dagenSindsBackup: dagenSindsBackup,
  maakBackup: maakBackup, zetBackupTerug: zetBackupTerug,
  downloadBackup: downloadBackup, leesBackupBestand: leesBackupBestand,
  cryptoKan: cryptoKan,
  legenGrens: legenGrens, moetLegen: moetLegen, leegBord: leegBord,
  HOEKKLEUREN: HOEKKLEUREN, hoekKleur: hoekKleur, hoekTinten: hoekTinten,
  mengMetWit: mengMetWit, donkerder: donkerder,
  SFEREN: SFEREN, sfeerVan: sfeerVan, uiterlijk: uiterlijk,
  achtergrondCss: achtergrondCss, achtergrondUitBestand: achtergrondUitBestand,

  DAGEN_KORT: DAGEN_KORT, DAGEN_LANG: DAGEN_LANG, WERKPLAATS_PLEKKEN: WERKPLAATS_PLEKKEN,
  STANDEN: STANDEN,
  weekSleutel: weekSleutel, weekVerschoven: weekVerschoven, weekLabel: weekLabel,
  dagVanVandaag: dagVanVandaag, week: week,
  weekNummer: weekNummer, weekDatums: weekDatums,
  taken: taken, taakVan: taakVan, nieuweTaak: nieuweTaak,
  werkplaatsHoek: werkplaatsHoek, zorgVoorWerkplaats: zorgVoorWerkplaats,
  weekTaak: weekTaak, weekTaakAls: weekTaakAls, haalWeekTaakWeg: haalWeekTaakWeg,
  standaardWerkmomenten: standaardWerkmomenten, werkmomenten: werkmomenten,
  dagRuimte: dagRuimte, momentGroepen: momentGroepen,
  geweestVandaag: geweestVandaag, markeerGeweest: markeerGeweest,
  datumSleutel: datumSleutel,
  toegewezen: toegewezen, dagVanKind: dagVanKind, zetKindOpDag: zetKindOpDag,
  beurtenTot: beurtenTot, verdeelAutomatisch: verdeelAutomatisch,
  geplandVandaag: geplandVandaag, heeftBeurtVandaag: heeftBeurtVandaag,
  standVan: standVan, zetStand: zetStand, wisStand: wisStand,
  volgendeStand: volgendeStand, isBeoordeeld: isBeoordeeld,
  STANDEN: STANDEN, standNaam: standNaam, standKort: standKort,
  beoordelingen: beoordelingen,
  ACTIVITEITSOORTEN: ACTIVITEITSOORTEN,
  themas: themas, themaVan: themaVan, nieuwThema: nieuwThema, haalThemaWeg: haalThemaWeg,
  takenVanThema: takenVanThema, hoekenVanThema: hoekenVanThema,
  themaVanWeek: themaVanWeek, themaStand: themaStand,
  LEERLIJNEN: LEERLIJNEN, DOMEINEN: DOMEINEN,
  domeinVanLeerlijn: domeinVanLeerlijn, leerlijnenPerDomein: leerlijnenPerDomein,
  hoekLeerlijnen: hoekLeerlijnen, hoekDomeinen: hoekDomeinen,
  stelLeerlijnenVoor: stelLeerlijnenVoor, dekkingVanHoeken: dekkingVanHoeken,
  pictos: pictos, voegPictoToe: voegPictoToe, pictoVan: pictoVan, koppelPicto: koppelPicto
};

})(window);
