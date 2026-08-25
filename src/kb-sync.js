/* ═══════════════════════════════════════════════════════════════════════
   Heen en weer met de server

   Het bord moet blijven werken als het internet even wegvalt -- een klas
   wacht niet. Daarom blijft de browser de baas over wat er op het scherm
   staat, en is de server de plek waar het samenkomt. Wat je doet gaat weg
   zodra het kan.

   Hoe het werkt: naast de gegevens van de groep bewaren we een afdruk van
   hoe die er stonden toen ze voor het laatst naar de server gingen. Bij
   het opsturen leggen we het huidige naast die afdruk. Wat verschilt, gaat
   mee. Zo hoeft geen enkele plek in de app te onthouden dat er iets
   veranderd is -- de vergelijking ziet het vanzelf.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
'use strict';

var DAGEN    = ['ma','di','wo','do','vr'];

var AFDRUK   = 'kb_afdruk';      // hoe de groep op de server stond
var KOPPEL   = 'kb_koppeling';   // welke lokale id hoort bij welke server-id
var WACHTEND = 'kb_wachtend';    // wat er nog weg moet

/* ── de vertaaltabel tussen lokale en server-namen ───────────────────── */
/* De app werkt met eigen id's als 'l7f3a2'; de server met uuid's. Deze
   twee lijstjes houden bij welke bij elkaar horen. */

function koppelingen(){
  try { return JSON.parse(localStorage.getItem(KOPPEL) || '{}'); }
  catch (e) { return {}; }
}
function bewaarKoppelingen(k){
  try { localStorage.setItem(KOPPEL, JSON.stringify(k)); } catch (e) {}
}
function opServer(lokaalId){ return koppelingen()[lokaalId] || null; }
function opLokaal(serverId){
  var k = koppelingen();
  for (var l in k) if (k[l] === serverId) return l;
  return null;
}
/* Een koppeling leggen, of met serverId leeg weer losmaken. */
function koppel(lokaalId, serverId){
  var k = koppelingen();
  if (serverId == null) delete k[lokaalId]; else k[lokaalId] = serverId;
  bewaarKoppelingen(k);
}

/* ── de afdruk ───────────────────────────────────────────────────────── */

function afdrukken(){
  try { return JSON.parse(localStorage.getItem(AFDRUK) || '{}'); }
  catch (e) { return {}; }
}
function afdrukVan(klasId){ return afdrukken()[klasId] || null; }
function zetAfdruk(klasId, plaat){
  var a = afdrukken(); a[klasId] = plaat;
  try { localStorage.setItem(AFDRUK, JSON.stringify(a)); } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════════
   Van de groep naar rijen, en terug
   ═══════════════════════════════════════════════════════════════════════ */

/* Alles wat naar de server gaat, plat als rijen per tabel. De sleutel van
   elke rij is het lokale id; dat vertalen we vlak voor het versturen. */

function naarRijen(k){
  var uit = {
    leerlingen:[], hoeken:[], borden:[], bord_hoeken:[], plaatsingen:[],
    wachtrij:[], taken:[], taak_doelen:[], groep_doelen:[],
    weekplannen:[], week_doelen:[], weekplan_taken:[], taak_toewijzing:[],
    observaties:[]
  };

  var pad = function (mediaId) {
    return global.KBMEDIA ? KBMEDIA.padVan(mediaId) : null;
  };

  (k.leerlingen || []).forEach(function (l, i) {
    uit.leerlingen.push({ _id:l.id, naam:l.naam, kleur:l.kleur || null,
                          foto_pad:pad(l.pictoId), volgorde:i,
                          actief:l.actief === false ? false : true });
  });

  (k.hoekLib || []).forEach(function (h, i) {
    uit.hoeken.push({ _id:h.id, naam:h.naam, max_kinderen:h.maxKinderen || 4,
                      kleur:h.kleur || null, icoon:h.icoon || null,
                      foto_pad:pad(h.fotoId),
                      timer_minuten:h.timerMinuten || null,
                      werkplaats:!!h.werkplaats, volgorde:i });
  });

  (k.borden || []).forEach(function (b, i) {
    uit.borden.push({ _id:b.id, naam:b.naam || 'Keuzebord', volgorde:i,
                      actief:b.id === k.activeBordId,
                      stand:{ dagOpen:!!b.dagOpen, dagGesloten:!!b.dagGesloten,
                              dagStart:b.dagStart || null, thema:b.thema || 'geen',
                              // wanneer het bord voor het laatst is leeggemaakt.
                              // Ging dit niet mee, dan dacht elk apparaat dat het
                              // nog moest gebeuren en veegde het bord bij het
                              // openen leeg -- ook wat de kinderen net kozen.
                              laatstGeleegd: b.laatstGeleegd || 0 } });
    (b.hoekLibIds || []).forEach(function (hid, j) {
      uit.bord_hoeken.push({ _id:b.id + '~' + hid, _bord:b.id, _hoek:hid, volgorde:j });
    });
    Object.keys(b.plaatsingen || {}).forEach(function (hid) {
      (b.plaatsingen[hid] || []).forEach(function (p) {
        uit.plaatsingen.push({ _id:b.id + '~' + p.leerlingId, _bord:b.id, _hoek:hid,
                               _leerling:p.leerlingId,
                               start_tijd:new Date(p.startTijd || Date.now()).toISOString() });
      });
    });
  });

  (k.wachtrij || []).forEach(function (w, i) {
    var b = (k.borden || [])[0];
    if (!b) return;
    uit.wachtrij.push({ _id:'w~' + w.leerlingId, _bord:b.id, _hoek:w.hoekId,
                        _leerling:w.leerlingId, volgorde:w.volgorde == null ? i : w.volgorde });
  });

  (k.taken || []).forEach(function (t) {
    uit.taken.push({ _id:t.id, naam:t.naam, omschrijving:t.omschrijving || '',
                     plekken:t.plekken || 6, kleur:t.kleur || null, actief:true });
    (t.doelIds || []).forEach(function (d) {
      uit.taak_doelen.push({ _id:t.id + '~' + d, _taak:t.id, _doel:d });
    });
  });

  Object.keys(k.doelActief || {}).forEach(function (d) {
    if (k.doelActief[d]) uit.groep_doelen.push({ _id:'gd~' + d, _doel:d });
  });

  Object.keys(k.weken || {}).forEach(function (sleutel) {
    var w = k.weken[sleutel];
    uit.weekplannen.push({ _id:'wp~' + sleutel, maandag:sleutel, notitie:w.notitie || '' });
    (w.centraleDoelIds || []).forEach(function (d) {
      uit.week_doelen.push({ _id:'wd~' + sleutel + '~' + d, _weekplan:'wp~' + sleutel, _doel:d });
    });
    (w.taken || []).forEach(function (wt, i) {
      var wtId = 'wt~' + sleutel + '~' + wt.taakId;
      uit.weekplan_taken.push({ _id:wtId, _weekplan:'wp~' + sleutel, _taak:wt.taakId, volgorde:i });
      DAGEN.forEach(function (dag, nr) {
        (wt.verdeling && wt.verdeling[dag] || []).forEach(function (lid) {
          uit.taak_toewijzing.push({
            _id:wtId + '~' + lid, _weekplantaak:wtId, _leerling:lid, dag:nr + 1,
            geweest:(wt.geweest && wt.geweest[lid]) || null,
            stand:(wt.afgerond && wt.afgerond[lid]) ? 'behaald' : 'nog' });
        });
      });
    });
  });

  /* Aan een taak hoeft geen doel te hangen. Beoordeel je zo'n taak, dan
     staat hij in de beoordelingen als "<kind>|taak:<taak>". Op de server
     is dat een observatie zonder doel_id, met alleen de taak erbij --
     anders zou 'taak:t2' als uuid de deur uit gaan en de hele push omvallen. */
  Object.keys(k.beoordelingen || {}).forEach(function (sleutel) {
    var deel = sleutel.split('|'), b = k.beoordelingen[sleutel];
    if (deel.length !== 2 || !b) return;
    var losseTaak = deel[1].indexOf('taak:') === 0 ? deel[1].slice(5) : null;
    uit.observaties.push({ _id:'o~' + sleutel, _leerling:deel[0],
                           _doel: losseTaak ? null : deel[1],
                           _taak: losseTaak || b.taakId || null,
                           stand:b.stand,
                           datum:new Date(b.datum || Date.now()).toISOString().slice(0,10) });
  });

  return uit;
}

/* De omgekeerde weg: rijen van de server terug naar de vorm die de app
   gebruikt. De id's blijven de lokale, zodat de rest van de app niets
   merkt van de vertaling. */

function naarKlas(rijen, bestaande){
  var k = bestaande || {};
  /* Van server-id naar lokaal id. Kent dit apparaat de rij nog niet -- het
     digibord dat de groep voor het eerst ophaalt -- dan wordt het server-id
     meteen ook het lokale id, en leggen we dat vast. Zonder die stap zou
     een wijziging vanaf dat apparaat als een nieuwe rij terugkomen. */
  var lok = function (serverId) {
    if (!serverId) return serverId;
    var l = opLokaal(serverId);
    if (l) return l;
    koppel(serverId, serverId);
    return serverId;
  };

  k.naam     = rijen.groep.naam;
  k.settings = Object.assign(KB.standaardInstellingen(), rijen.groep.instellingen || {});
  if (rijen.groep.uiterlijk && Object.keys(rijen.groep.uiterlijk).length) {
    k.uiterlijk = rijen.groep.uiterlijk;
  }

  k.leerlingen = (rijen.leerlingen || []).map(function (r) {
    var oud = (bestaande && bestaande.leerlingen || []).filter(function (x) { return x.id === lok(r.id); })[0];
    return { id:lok(r.id), naam:r.naam, kleur:r.kleur,
             actief:r.actief, image:oud ? oud.image : null };
  });

  k.hoekLib = (rijen.hoeken || []).map(function (r) {
    var oud = (bestaande && bestaande.hoekLib || []).filter(function (x) { return x.id === lok(r.id); })[0];
    return { id:lok(r.id), naam:r.naam, maxKinderen:r.max_kinderen, kleur:r.kleur,
             icoon:r.icoon, timerMinuten:r.timer_minuten, werkplaats:r.werkplaats,
             fotoId:oud ? oud.fotoId : null };
  });

  k.borden = (rijen.borden || []).map(function (r) {
    var stand = r.stand || {};
    var bordId = lok(r.id);
    var hoekIds = (rijen.bord_hoeken || [])
      .filter(function (x) { return x.bord_id === r.id; })
      .sort(function (a, b) { return a.volgorde - b.volgorde; })
      .map(function (x) { return lok(x.hoek_id); });
    var plaatsingen = {};
    (rijen.plaatsingen || []).filter(function (p) { return p.bord_id === r.id; })
      .forEach(function (p) {
        var h = lok(p.hoek_id);
        (plaatsingen[h] = plaatsingen[h] || []).push({
          leerlingId: lok(p.leerling_id), startTijd: new Date(p.start_tijd).getTime() });
      });
    return { id:bordId, naam:r.naam, hoekLibIds:hoekIds, plaatsingen:plaatsingen,
             dagOpen:!!stand.dagOpen, dagGesloten:!!stand.dagGesloten,
             dagStart:stand.dagStart || null, thema:stand.thema || 'geen',
             laatstGeleegd: stand.laatstGeleegd || 0 };
  });
  // Een groep die op de server is aangemaakt heeft nog geen bord. De app
  // gaat er wel altijd van uit dat er eentje is, dus die maken we hier --
  // bij het eerstvolgende opsturen komt hij vanzelf op de server te staan.
  if (!k.borden.length) {
    k.borden = [{ id:'b' + Math.random().toString(36).slice(2, 9), naam:'Keuzebord',
                  hoekLibIds:[], plaatsingen:{}, dagOpen:false, dagGesloten:false,
                  dagStart:null, thema:'geen', laatstGeleegd: Date.now() }];
  }
  var actief = (rijen.borden || []).filter(function (r) { return r.actief; })[0];
  k.activeBordId = actief ? lok(actief.id) : k.borden[0].id;

  k.wachtrij = (rijen.wachtrij || []).map(function (r) {
    return { leerlingId:lok(r.leerling_id), hoekId:lok(r.hoek_id), volgorde:r.volgorde };
  });

  k.taken = (rijen.taken || []).map(function (r) {
    return { id:lok(r.id), naam:r.naam, omschrijving:r.omschrijving,
             plekken:r.plekken, kleur:r.kleur,
             doelIds:(rijen.taak_doelen || []).filter(function (x) { return x.taak_id === r.id; })
                       .map(function (x) { return lok(x.doel_id); }),
             gemaakt:new Date(r.aangemaakt).getTime() };
  });

  k.doelActief = {};
  (rijen.groep_doelen || []).forEach(function (r) { k.doelActief[lok(r.doel_id)] = true; });

  k.weken = {};
  (rijen.weekplannen || []).forEach(function (r) {
    var sleutel = String(r.maandag).slice(0, 10);
    var taken = (rijen.weekplan_taken || []).filter(function (x) { return x.weekplan_id === r.id; })
      .sort(function (a, b) { return a.volgorde - b.volgorde; })
      .map(function (wt) {
        var verdeling = {}; DAGEN.forEach(function (d) { verdeling[d] = []; });
        var afgerond = {}, geweest = {};
        (rijen.taak_toewijzing || []).filter(function (t) { return t.weekplan_taak_id === wt.id; })
          .forEach(function (t) {
            var dag = DAGEN[(t.dag || 1) - 1] || 'ma';
            verdeling[dag].push(lok(t.leerling_id));
            if (t.stand === 'behaald') afgerond[lok(t.leerling_id)] = true;
            if (t.geweest) geweest[lok(t.leerling_id)] = String(t.geweest).slice(0, 10);
          });
        return { taakId:lok(wt.taak_id), verdeling:verdeling,
                 afgerond:afgerond, geweest:geweest };
      });
    k.weken[sleutel] = {
      notitie: r.notitie,
      centraleDoelIds: (rijen.week_doelen || []).filter(function (x) { return x.weekplan_id === r.id; })
                         .map(function (x) { return lok(x.doel_id); }),
      taken: taken
    };
  });

  // Het logboek van de server erbij. Wat hier lokaal al stond en nog niet
  // verstuurd is blijft staan; dubbele regels vallen op tijd en soort weg.
  if (rijen.gebeurtenissen) {
    var vanServer = (rijen.gebeurtenissen || []).map(function (r) {
      var g = { soort:r.soort, tijd:new Date(r.tijd).getTime() };
      Object.keys(r.gegevens || {}).forEach(function (veld) {
        g[veld] = (veld === 'leerlingId' || veld === 'hoekId')
          ? lok(r.gegevens[veld]) : r.gegevens[veld];
      });
      return g;
    });
    var gezien = {};
    var alles = vanServer.concat(k.gebeurtenissen || []);
    k.gebeurtenissen = alles.filter(function (g) {
      var s2 = g.tijd + '|' + g.soort + '|' + (g.leerlingId || '') + '|' + (g.hoekId || '');
      if (gezien[s2]) return false;
      gezien[s2] = true;
      return true;
    }).sort(function (a, b) { return a.tijd - b.tijd; }).slice(-4000);
  }

  k.beoordelingen = {};
  (rijen.observaties || []).forEach(function (r) {
    // zonder doel is het de beoordeling van de taak zelf
    var waarover = r.doel_id ? lok(r.doel_id)
                 : r.taak_id ? 'taak:' + lok(r.taak_id) : null;
    if (!waarover) return;
    k.beoordelingen[lok(r.leerling_id) + '|' + waarover] = {
      stand:r.stand, taakId:r.taak_id ? lok(r.taak_id) : null,
      datum:new Date(r.datum).getTime() };
  });

  if (!k.fotoLib) k.fotoLib = [];
  return k;
}

/* ═══════════════════════════════════════════════════════════════════════
   Wat er waar heen moet
   ═══════════════════════════════════════════════════════════════════════ */

/* Per tabel: waar hij aan hangt, en welke van onze verwijzingen naar
   welke kolom gaat. De volgorde telt -- een plaatsing kan pas weg als het
   bord en het kind er al zijn. Bij het verwijderen gaan we achterstevoren. */
var TABELLEN = [
  { naam:'leerlingen',      hangtAan:'groep' },
  { naam:'hoeken',          hangtAan:'groep', ook:['school'] },
  { naam:'taken',           hangtAan:'groep' },
  { naam:'borden',          hangtAan:'groep' },
  { naam:'weekplannen',     hangtAan:'groep' },
  { naam:'groep_doelen',    hangtAan:'groep', samengesteld:['groep_id','doel_id'] },
  { naam:'bord_hoeken',     samengesteld:['bord_id','hoek_id'] },
  { naam:'taak_doelen',     samengesteld:['taak_id','doel_id'] },
  { naam:'week_doelen',     samengesteld:['weekplan_id','doel_id'] },
  { naam:'weekplan_taken' },
  { naam:'plaatsingen' },
  { naam:'wachtrij' },
  { naam:'taak_toewijzing' },
  { naam:'observaties',     hangtAan:'groep' }
];

var VERWIJST = { _bord:'bord_id', _hoek:'hoek_id', _leerling:'leerling_id',
                 _taak:'taak_id', _doel:'doel_id', _weekplan:'weekplan_id',
                 _weekplantaak:'weekplan_taak_id' };

/* ── verschillen zoeken ──────────────────────────────────────────────── */

function opSleutel(rijen){
  var uit = {}; (rijen || []).forEach(function (r) { uit[r._id] = r; }); return uit;
}
function zelfde(a, b){
  var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return false;
  return ka.every(function (s) { return JSON.stringify(a[s]) === JSON.stringify(b[s]); });
}

/* Leg het huidige naast de afdruk en zeg wat er anders is. */
function verschil(nu, toen){
  var uit = {};
  Object.keys(nu).forEach(function (tabel) {
    var a = opSleutel(nu[tabel]), b = opSleutel((toen || {})[tabel]);
    var nieuw = [], gewijzigd = [], weg = [];
    Object.keys(a).forEach(function (s) {
      if (!b[s]) nieuw.push(a[s]);
      else if (!zelfde(a[s], b[s])) gewijzigd.push(a[s]);
    });
    Object.keys(b).forEach(function (s) { if (!a[s]) weg.push(b[s]); });
    if (nieuw.length || gewijzigd.length || weg.length) {
      uit[tabel] = { nieuw:nieuw, gewijzigd:gewijzigd, weg:weg };
    }
  });
  return uit;
}

/* ── de doelenlijst ──────────────────────────────────────────────────── */
/* De lijst met doelen staat in de app als een bestand met eigen id's. Op
   de server krijgt elk doel een uuid. We zetten de lijst één keer per
   school klaar en onthouden welk uuid bij welk id hoort; daarna kunnen
   taken en observaties er gewoon naar wijzen. */

function zorgVoorDoelen(schoolId){
  // doelenLaad() geeft { meta, lijst } terug -- niet de lijst zelf. Dat
  // verschil kostte ons de hele doelenlijst: hij werd nooit verstuurd, en
  // alles wat ernaar verwees viel daarna om.
  var pak = KB.doelenLaad() || {};
  var lokaal = pak.lijst || (KB.doelen && KB.doelen.lijst) || [];
  if (!lokaal.length) return Promise.resolve();
  return SB.lees('doelen', { kies:'id,code' }).then(function (bestaand) {
    var perCode = {};
    (bestaand || []).forEach(function (d) { if (d.code) perCode[d.code] = d.id; });
    var ontbreekt = lokaal.filter(function (d) { return !perCode[d.id]; });
    (bestaand || []).forEach(function (d) { if (d.code) koppel(d.code, d.id); });
    if (!ontbreekt.length) return;
    // in stukken, anders wordt het één heel groot verzoek
    var stukken = [];
    for (var i = 0; i < ontbreekt.length; i += 200) stukken.push(ontbreekt.slice(i, i + 200));
    return stukken.reduce(function (rij, stuk) {
      return rij.then(function () {
        return SB.schrijf('doelen', stuk.map(function (d) {
          return { school_id:schoolId, code:d.id, niveau:d.niveau || '',
                   domein:d.domein || '', leerlijn:d.leerlijn || '',
                   aspect:d.aspect || '', doel:d.doel || '', ster:!!d.ster };
        })).then(function (terug) {
          (terug || []).forEach(function (d) { if (d.code) koppel(d.code, d.id); });
        });
      });
    }, Promise.resolve());
  });
}

/* ── het logboek ──────────────────────────────────────────────────────
   Wie wanneer welke hoek koos. Dat groeit alleen maar aan en wordt nooit
   gewijzigd, dus we vergelijken het niet met een afdruk -- we sturen wat
   er sinds de vorige keer bij is gekomen. Anders zouden duizenden regels
   elke keer opnieuw langs de vergelijking moeten. */

var LOGGRENS = 'kb_loggrens';

function loggrens(klasId){
  try { return JSON.parse(localStorage.getItem(LOGGRENS) || '{}')[klasId] || 0; }
  catch (e) { return 0; }
}
function zetLoggrens(klasId, tijd){
  try {
    var g = JSON.parse(localStorage.getItem(LOGGRENS) || '{}');
    g[klasId] = tijd;
    localStorage.setItem(LOGGRENS, JSON.stringify(g));
  } catch (e) {}
}

function stuurLogOp(k, klasId, groepId){
  var grens = loggrens(klasId);
  var nieuwe = (k.gebeurtenissen || []).filter(function (g) { return g.tijd > grens; });
  if (!nieuwe.length) return Promise.resolve(0);

  var hoogste = grens;
  var rijen = nieuwe.map(function (g) {
    if (g.tijd > hoogste) hoogste = g.tijd;
    var gegevens = {};
    Object.keys(g).forEach(function (veld) {
      if (veld === 'soort' || veld === 'tijd') return;
      // verwijzingen vertalen naar wat de server kent
      if (veld === 'leerlingId' || veld === 'hoekId') {
        gegevens[veld] = opServer(g[veld]) || g[veld];
      } else gegevens[veld] = g[veld];
    });
    return { groep_id:groepId, tijd:new Date(g.tijd).toISOString(),
             soort:g.soort, gegevens:gegevens };
  });

  // in stukken, anders wordt het één heel groot verzoek
  var stukken = [];
  for (var i = 0; i < rijen.length; i += 200) stukken.push(rijen.slice(i, i + 200));
  return stukken.reduce(function (rij, stuk) {
    return rij.then(function () { return SB.schrijf('gebeurtenissen', stuk); });
  }, Promise.resolve()).then(function () {
    zetLoggrens(klasId, hoogste);
    return rijen.length;
  });
}

/* ── opsturen ────────────────────────────────────────────────────────── */

function serverRij(rij, tabel, groepId, schoolId){
  var uit = {};
  Object.keys(rij).forEach(function (veld) {
    if (veld === '_id') return;
    if (VERWIJST[veld]) {
      var doel = rij[veld];
      uit[VERWIJST[veld]] = doel == null ? null : (opServer(doel) || doel);
    } else if (veld.charAt(0) !== '_') {
      uit[veld] = rij[veld];
    }
  });
  if (tabel.hangtAan === 'groep') uit.groep_id = groepId;
  if ((tabel.ook || []).indexOf('school') >= 0) uit.school_id = schoolId;
  return uit;
}

function duw(klasId, groepId, schoolId){
  var k = (KB.G.klassen || []).filter(function (x) { return x.id === klasId; })[0];
  if (!k) return Promise.reject(new Error('Die groep ken ik niet.'));

  var vooraf = zorgVoorDoelen(schoolId);
  // eerst de foto's, want de rijen van kinderen en hoeken wijzen ernaar
  if (global.KBMEDIA) {
    vooraf = vooraf.then(function () { return KBMEDIA.stuurOp(k, groepId, schoolId); });
  }
  return vooraf.then(function () {
    var nu   = naarRijen(k);
    var toen = afdrukVan(klasId);
    var wat  = verschil(nu, toen);

    // eerst de instellingen van de groep zelf
    var start = Promise.resolve();
    if (!toen || JSON.stringify(toen._groep) !== JSON.stringify(groepGegevens(k))) {
      start = SB.wijzig('groepen', groepGegevens(k), { id:'eq.' + groepId });
    }

    // dan alles wat erbij hoort, in de goede volgorde
    var rij = start;
    TABELLEN.forEach(function (tabel) {
      var d = wat[tabel.naam];
      if (!d) return;
      rij = rij.then(function () {
        var stappen = [];
        if (d.nieuw.length) {
          stappen.push(function () {
            // Een tabel met een samengestelde sleutel kan dezelfde rij niet
            // twee keer hebben. Ging er onderweg iets mis en proberen we het
            // opnieuw, dan staat een deel er al -- dus laten we de server
            // botsingen opvangen in plaats van eraan stuk te gaan.
            var opties = tabel.samengesteld
              ? { opKolommen: tabel.samengesteld.join(','), bijBotsing: true }
              : {};
            return SB.schrijf(tabel.naam, d.nieuw.map(function (r) {
              return serverRij(r, tabel, groepId, schoolId);
            }), opties).then(function (terug) {
              // de server gaf ons uuid's; onthouden welke bij welke horen
              if (tabel.samengesteld) return;
              (terug || []).forEach(function (r, i) {
                if (d.nieuw[i]) koppel(d.nieuw[i]._id, r.id);
              });
            });
          });
        }
        d.gewijzigd.forEach(function (r) {
          stappen.push(function () {
            var waarden = serverRij(r, tabel, groepId, schoolId);
            if (tabel.samengesteld) return Promise.resolve();   // niets om te wijzigen
            var id = opServer(r._id);
            if (!id) return SB.schrijf(tabel.naam, [waarden]).then(function (t) {
              if (t && t[0]) koppel(r._id, t[0].id);
            });
            return SB.wijzig(tabel.naam, waarden, { id:'eq.' + id });
          });
        });
        d.weg.forEach(function (r) {
          stappen.push(function () {
            if (tabel.samengesteld) {
              var waar = {}; var waarden = serverRij(r, tabel, groepId, schoolId);
              tabel.samengesteld.forEach(function (kol) { waar[kol] = 'eq.' + waarden[kol]; });
              return SB.wis(tabel.naam, waar);
            }
            var id = opServer(r._id);
            return id ? SB.wis(tabel.naam, { id:'eq.' + id }) : Promise.resolve();
          });
        });
        return stappen.reduce(function (p, stap) { return p.then(stap); }, Promise.resolve());
      });
    });

    return rij.then(function () {
      return stuurLogOp(k, klasId, groepId).catch(function () { return 0; });
    }).then(function () {
      nu._groep = groepGegevens(k);
      zetAfdruk(klasId, nu);
      return wat;
    });
  });
}

function groepGegevens(k){
  return { naam:k.naam, instellingen:k.settings || {}, uiterlijk:k.uiterlijk || {} };
}

/* ── ophalen ─────────────────────────────────────────────────────────── */

function haal(groepId){
  var bordIds = null;
  return SB.lees('groepen', { kies:'*', waar:{ id:'eq.' + groepId } }).then(function (g) {
    if (!g || !g.length) throw new Error('Die groep staat niet op de server.');
    var rijen = { groep:g[0] };
    var perGroep = ['leerlingen','hoeken','taken','borden','weekplannen','groep_doelen','observaties'];
    return Promise.all(perGroep.map(function (t) {
      return SB.lees(t, { kies:'*', waar:{ groep_id:'eq.' + groepId } })
               .then(function (r) { rijen[t] = r || []; });
    })).then(function () {
      // de tabellen die aan een bord, taak of weekplan hangen
      var borden  = rijen.borden.map(function (b) { return b.id; });
      var taken   = rijen.taken.map(function (t) { return t.id; });
      var weken   = rijen.weekplannen.map(function (w) { return w.id; });
      var lijstje = function (ids) { return '(' + ids.join(',') + ')'; };
      var werk = [];
      var haalVoor = function (tabel, kolom, ids) {
        if (!ids.length) { rijen[tabel] = []; return; }
        var waar = {}; waar[kolom] = 'in.' + lijstje(ids);
        werk.push(SB.lees(tabel, { kies:'*', waar:waar }).then(function (r) { rijen[tabel] = r || []; }));
      };
      werk.push(SB.lees('gebeurtenissen', { kies:'tijd,soort,gegevens',
        waar:{ groep_id:'eq.' + groepId }, volgorde:'tijd', hoeveel:4000 })
        .then(function (r) { rijen.gebeurtenissen = r || []; })
        .catch(function () { rijen.gebeurtenissen = []; }));
      haalVoor('bord_hoeken',    'bord_id',     borden);
      haalVoor('plaatsingen',    'bord_id',     borden);
      haalVoor('wachtrij',       'bord_id',     borden);
      haalVoor('taak_doelen',    'taak_id',     taken);
      haalVoor('week_doelen',    'weekplan_id', weken);
      haalVoor('weekplan_taken', 'weekplan_id', weken);
      return Promise.all(werk).then(function () {
        var wt = (rijen.weekplan_taken || []).map(function (x) { return x.id; });
        if (!wt.length) { rijen.taak_toewijzing = []; return; }
        return SB.lees('taak_toewijzing', { kies:'*',
          waar:{ weekplan_taak_id:'in.(' + wt.join(',') + ')' } })
          .then(function (r) { rijen.taak_toewijzing = r || []; });
      });
    }).then(function () { return rijen; });
  });
}

/* Haal de groep op en zet hem in de app. Wat de server heeft, wint --
   deze kant gebruiken we als een apparaat bijgepraat moet worden. */
function haalBinnen(klasId, groepId){
  return haal(groepId).then(function (rijen) {
    var bestaande = (KB.G.klassen || []).filter(function (x) { return x.id === klasId; })[0];
    if (!bestaande) { bestaande = { id:klasId }; KB.G.klassen.push(bestaande); }
    naarKlas(rijen, bestaande);
    koppel(klasId, groepId);
    // de foto's erbij, en dan de kinderen en hoeken er weer aan hangen
    var foto = global.KBMEDIA
      ? KBMEDIA.haalBinnen(bestaande, groepId)
          .then(function () { KBMEDIA.koppelTerug(bestaande, rijen); })
          .then(function () { return KBMEDIA.bewaarInKluis(bestaande); })
          .catch(function () {})
      : Promise.resolve();
    return foto.then(function () { return doorMetAfdruk(bestaande, klasId); });
  });
}

function doorMetAfdruk(bestaande, klasId){
    KB.bewaar();
    var plaat = naarRijen(bestaande);
    plaat._groep = groepGegevens(bestaande);
    zetAfdruk(klasId, plaat);
    return bestaande;
}

/* ── wat er nog weg moet ─────────────────────────────────────────────── */
/* Lukt het opsturen niet, dan onthouden we dat er iets klaarstaat. Bij de
   volgende poging gaat het alsnog mee; de vergelijking met de afdruk zorgt
   er vanzelf voor dat er niets dubbel gebeurt. */

function markeerWachtend(klasId, aan){
  try {
    var w = JSON.parse(localStorage.getItem(WACHTEND) || '{}');
    if (aan) w[klasId] = Date.now(); else delete w[klasId];
    localStorage.setItem(WACHTEND, JSON.stringify(w));
  } catch (e) {}
}
function wachtErIetsOp(klasId){
  try {
    var w = JSON.parse(localStorage.getItem(WACHTEND) || '{}');
    return klasId ? !!w[klasId] : Object.keys(w).length > 0;
  } catch (e) { return false; }
}

/* Het gewone gebruik: probeer op te sturen, en klaag niet als het even
   niet kan. Een juf hoeft niet te weten dat de wifi hikte. */
function stuurOp(klasId, groepId, schoolId){
  return duw(klasId, groepId, schoolId).then(function (wat) {
    markeerWachtend(klasId, false);
    return { gelukt:true, veranderd:wat };
  }, function (e) {
    if (e && e.offline) { markeerWachtend(klasId, true); return { gelukt:false, offline:true }; }
    throw e;
  });
}

global.KBSYNC = {
  markeerWachtend: markeerWachtend,
  haal: haal, haalBinnen: haalBinnen, duw: duw, stuurOp: stuurOp,
  verschil: verschil, naarRijen: naarRijen, naarKlas: naarKlas,
  zorgVoorDoelen: zorgVoorDoelen,
  opServer: opServer, opLokaal: opLokaal, koppel: koppel,
  afdrukVan: afdrukVan, zetAfdruk: zetAfdruk,
  wachtErIetsOp: wachtErIetsOp
};


})(window);
