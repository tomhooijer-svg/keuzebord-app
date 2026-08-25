/* ═══════════════════════════════════════════════════════════════════════
   Wat er te zien is in wat er gebeurde

   Het bord houdt bij wie wanneer welke hoek koos. Daar valt uit af te
   lezen wat je in de drukte van een schooldag niet ziet: dat Sem bijna
   altijd in de bouwhoek zit, dat Noor en Liam elkaar nooit tegenkomen, dat
   er één kind is dat in geen enkele hoek met iemand anders speelt.

   Niets hiervan is een oordeel. Het zijn tellingen, en de juf weet wat ze
   betekenen.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
'use strict';

var DAG = 24 * 60 * 60 * 1000;

/* ── van gebeurtenissen naar bezoekjes ────────────────────────────────
   Het logboek zegt "Sem koos de bouwhoek" en later "Sem ging weg". Daar
   maken we blokjes tijd van. Wie nog zit, telt tot nu. */

function bezoekjes(k, vanaf){
  k = k || KB.klas();
  var log = (k.gebeurtenissen || []).filter(function (g) {
    return !vanaf || g.tijd >= vanaf;
  });
  var open = {};      // leerlingId -> begonnen bezoek
  var uit = [];

  function sluit(id, tijd){
    var b = open[id];
    if (!b) return;
    b.tot = tijd;
    b.minuten = Math.max(0, Math.round((b.tot - b.van) / 60000));
    uit.push(b);
    delete open[id];
  }

  log.slice().sort(function (a, b) { return a.tijd - b.tijd; }).forEach(function (g) {
    if (!g.leerlingId) return;
    if (g.soort === 'gekozen') {
      sluit(g.leerlingId, g.tijd);          // een kind kan maar op één plek zijn
      open[g.leerlingId] = { leerlingId:g.leerlingId, hoekId:g.hoekId, van:g.tijd };
    } else if (g.soort === 'weg' || g.soort === 'opgeruimd') {
      sluit(g.leerlingId, g.tijd);
    }
  });
  // wie nu nog zit
  var nu = Date.now();
  Object.keys(open).forEach(function (id) { sluit(id, nu); });

  return uit.sort(function (a, b) { return a.van - b.van; });
}

/* ── per kind ─────────────────────────────────────────────────────────
   Hoe vaak koos dit kind welke hoek, en hoe lang zat het er. */

function perKind(k, opties){
  k = k || KB.klas();
  opties = opties || {};
  var vanaf = opties.dagen ? Date.now() - opties.dagen * DAG : null;
  var lijst = bezoekjes(k, vanaf);

  var uit = {};
  (k.leerlingen || []).forEach(function (l) {
    uit[l.id] = { leerlingId:l.id, naam:l.naam, keuzes:0, minuten:0,
                  perHoek:{}, favoriet:null, hoekenBezocht:0 };
  });
  lijst.forEach(function (b) {
    var r = uit[b.leerlingId];
    if (!r) return;
    r.keuzes++;
    r.minuten += b.minuten || 0;
    r.perHoek[b.hoekId] = (r.perHoek[b.hoekId] || 0) + 1;
  });
  Object.keys(uit).forEach(function (id) {
    var r = uit[id];
    var beste = null;
    Object.keys(r.perHoek).forEach(function (h) {
      if (!beste || r.perHoek[h] > r.perHoek[beste]) beste = h;
    });
    r.favoriet = beste;
    r.hoekenBezocht = Object.keys(r.perHoek).length;
    r.deelFavoriet = r.keuzes ? (r.perHoek[beste] || 0) / r.keuzes : 0;
  });
  return uit;
}

/* ── per hoek ─────────────────────────────────────────────────────── */

function perHoek(k, opties){
  k = k || KB.klas();
  opties = opties || {};
  var vanaf = opties.dagen ? Date.now() - opties.dagen * DAG : null;
  var lijst = bezoekjes(k, vanaf);

  var uit = {};
  (k.hoekLib || []).forEach(function (h) {
    uit[h.id] = { hoekId:h.id, naam:h.naam, keuzes:0, minuten:0, kinderen:{} };
  });
  lijst.forEach(function (b) {
    var r = uit[b.hoekId];
    if (!r) return;
    r.keuzes++;
    r.minuten += b.minuten || 0;
    r.kinderen[b.leerlingId] = (r.kinderen[b.leerlingId] || 0) + 1;
  });
  Object.keys(uit).forEach(function (id) {
    uit[id].verschillendeKinderen = Object.keys(uit[id].kinderen).length;
  });
  return uit;
}

/* ── wie met wie ──────────────────────────────────────────────────────
   Twee kinderen speelden samen als ze op hetzelfde moment in dezelfde
   hoek zaten. We tellen de minuten dat dat zo was; dat zegt meer dan het
   aantal keren, want vijf minuten samen is iets anders dan een uur. */

function paren(k, opties){
  k = k || KB.klas();
  opties = opties || {};
  var vanaf = opties.dagen ? Date.now() - opties.dagen * DAG : null;
  var lijst = bezoekjes(k, vanaf);

  // per hoek de bezoekjes bij elkaar, dan paarsgewijs kijken of ze
  // elkaar in de tijd overlappen
  var perHoekLijst = {};
  lijst.forEach(function (b) {
    (perHoekLijst[b.hoekId] = perHoekLijst[b.hoekId] || []).push(b);
  });

  var samen = {};   // "id1|id2" -> { minuten, keren, hoeken:{} }
  function sleutel(a, b){ return a < b ? a + '|' + b : b + '|' + a; }

  Object.keys(perHoekLijst).forEach(function (hoekId) {
    var bs = perHoekLijst[hoekId];
    for (var i = 0; i < bs.length; i++) {
      for (var j = i + 1; j < bs.length; j++) {
        if (bs[i].leerlingId === bs[j].leerlingId) continue;
        var van = Math.max(bs[i].van, bs[j].van);
        var tot = Math.min(bs[i].tot, bs[j].tot);
        if (tot <= van) continue;
        var minuten = Math.round((tot - van) / 60000);
        if (minuten < 1) continue;
        var s = sleutel(bs[i].leerlingId, bs[j].leerlingId);
        var r = samen[s] || (samen[s] = { a:s.split('|')[0], b:s.split('|')[1],
                                          minuten:0, keren:0, hoeken:{} });
        r.minuten += minuten;
        r.keren++;
        r.hoeken[hoekId] = (r.hoeken[hoekId] || 0) + 1;
      }
    }
  });

  return Object.keys(samen).map(function (s) { return samen[s]; })
    .sort(function (x, y) { return y.minuten - x.minuten; });
}

/* Wie kwam elkaar nooit tegen. Alleen tussen kinderen die allebei wél
   gespeeld hebben -- anders zegt het niets. */
function nooitSamen(k, opties){
  k = k || KB.klas();
  var kinderen = (k.leerlingen || []).filter(function (l) { return l.lid !== false; });
  var telling = perKind(k, opties);
  var actief = kinderen.filter(function (l) {
    return (telling[l.id] || {}).keuzes > 0;
  });
  var wel = {};
  paren(k, opties).forEach(function (r) { wel[r.a + '|' + r.b] = true; wel[r.b + '|' + r.a] = true; });

  var uit = [];
  for (var i = 0; i < actief.length; i++) {
    for (var j = i + 1; j < actief.length; j++) {
      if (!wel[actief[i].id + '|' + actief[j].id]) {
        uit.push({ a:actief[i].id, b:actief[j].id });
      }
    }
  }
  return uit;
}

/* Met wie speelt dit kind het vaakst, en wie ziet het nooit. */
function maatjesVan(leerlingId, k, opties){
  k = k || KB.klas();
  var mijn = paren(k, opties).filter(function (r) {
    return r.a === leerlingId || r.b === leerlingId;
  }).map(function (r) {
    return { leerlingId: r.a === leerlingId ? r.b : r.a,
             minuten: r.minuten, keren: r.keren, hoeken: r.hoeken };
  });
  return mijn;
}

/* ── wat valt op ──────────────────────────────────────────────────────
   Voor het overzichtsscherm: een handvol dingen die de moeite van het
   noemen waard zijn. Kort, en met een reden erbij. */

function opvallend(k, opties){
  k = k || KB.klas();
  opties = opties || { dagen: 21 };
  var uit = [];
  var kinderen = (k.leerlingen || []).filter(function (l) { return l.lid !== false; });
  if (!kinderen.length) return uit;

  var telling = perKind(k, opties);
  var hoeken = perHoek(k, opties);
  var naam = function (id) { var l = KB.leerling(id, k); return l ? l.naam : 'iemand'; };
  var hoeknaam = function (id) { var h = KB.hoekVan(id, k); return h ? h.naam : 'een hoek'; };

  var metKeuzes = kinderen.filter(function (l) { return (telling[l.id] || {}).keuzes > 0; });
  if (!metKeuzes.length) return uit;

  // kinderen die bijna altijd hetzelfde kiezen
  metKeuzes.forEach(function (l) {
    var r = telling[l.id];
    if (r.keuzes >= 4 && r.deelFavoriet >= 0.7) {
      uit.push({ soort:'vast', leerlingId:l.id,
                 tekst: naam(l.id) + ' kiest bijna altijd ' + hoeknaam(r.favoriet) +
                        ' (' + Math.round(r.deelFavoriet * 100) + '% van ' + r.keuzes + ' keer)' });
    }
  });

  // kinderen die nog nergens zijn geweest
  var stil = kinderen.filter(function (l) { return !(telling[l.id] || {}).keuzes; });
  if (stil.length && stil.length <= 5) {
    uit.push({ soort:'stil',
               tekst: (stil.length === 1 ? stil[0].naam + ' heeft ' : stil.map(function (l) { return l.naam; }).join(', ') + ' hebben ') +
                      'nog geen enkele keer gekozen' });
  }

  // hoeken waar bijna niemand komt
  Object.keys(hoeken).forEach(function (id) {
    var h = hoeken[id];
    if (h.keuzes === 0) {
      uit.push({ soort:'lege-hoek', hoekId:id, tekst: h.naam + ' is nog niet gekozen' });
    } else if (h.verschillendeKinderen <= 2 && metKeuzes.length >= 6) {
      uit.push({ soort:'smalle-hoek', hoekId:id,
                 tekst: h.naam + ' wordt maar door ' + h.verschillendeKinderen +
                        ' kind' + (h.verschillendeKinderen === 1 ? '' : 'eren') + ' gekozen' });
    }
  });

  // een stel dat opvallend veel samen zit
  var stellen = paren(k, opties);
  if (stellen.length && stellen[0].minuten >= 45) {
    uit.push({ soort:'maatjes',
               tekst: naam(stellen[0].a) + ' en ' + naam(stellen[0].b) + ' zitten veel samen (' +
                      stellen[0].minuten + ' minuten, ' + stellen[0].keren + ' keer)' });
  }

  // een kind dat vrijwel alleen speelt
  metKeuzes.forEach(function (l) {
    var mijn = maatjesVan(l.id, k, opties);
    var totaal = mijn.reduce(function (n, m) { return n + m.minuten; }, 0);
    if ((telling[l.id].keuzes >= 4) && totaal < 10) {
      uit.push({ soort:'alleen', leerlingId:l.id,
                 tekst: naam(l.id) + ' speelt bijna altijd zonder anderen in de buurt' });
    }
  });

  return uit;
}

global.KBSTAT = {
  bezoekjes: bezoekjes,
  perKind: perKind, perHoek: perHoek,
  paren: paren, nooitSamen: nooitSamen, maatjesVan: maatjesVan,
  opvallend: opvallend
};

})(window);
