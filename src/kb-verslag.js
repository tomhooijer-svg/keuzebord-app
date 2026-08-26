/* ══════════════════════════════════════════════════════════════
   VERSLAG
   Een oudergesprek gaat over één kind. De juf wil dan geen scherm
   met filters, maar een blaadje: dit heeft hij al onder de knie,
   hier zijn we mee bezig, dit kiest hij graag, en hier speelt hij
   het liefst met wie.

   Een echte PDF-bibliotheek zou een bestand van een halve megabyte
   meebrengen, en die moet dan ook nog offline werken. Dat hoeft
   niet: elke browser kan zelf naar PDF afdrukken. We bouwen dus
   een schoon blad in een verborgen kader en laten de browser dat
   afdrukken -- in het afdrukvenster kies je "Bewaren als PDF".
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

/* ── de gegevens bij elkaar zoeken ────────────────────────────── */

function doelVan(id){
  var lijst = (KB.doelen && KB.doelen.lijst) || [];
  for (var i = 0; i < lijst.length; i++) if (lijst[i].id === id) return lijst[i];
  return null;
}
function doelTekst(d){ return (d.aspect ? d.aspect + ': ' : '') + d.doel; }

/* Aan een taak hoeft geen doel te hangen; die beoordeel je dan als
   taak. In de beoordelingen staat zo'n taak als "taak:<id>". */
function losseTaak(sleutel, k){
  if (String(sleutel).indexOf('taak:') !== 0) return null;
  return KB.taakVan(String(sleutel).slice(5), k);
}

function doelenVanKind(leerlingId, k, opties){
  k = k || KB.klas();
  opties = opties || {};
  var alle = KB.beoordelingen(k);
  var behaald = [], bezig = [], ontdekt = [], gezien = {};

  Object.keys(alle).forEach(function (sleutel) {
    var stuk = sleutel.split('|');
    if (stuk[0] !== leerlingId) return;
    var doelId = stuk.slice(1).join('|');
    var b = alle[sleutel];
    if (!b || KB.STANDEN.indexOf(b.stand) < 0) return;

    var taak = losseTaak(doelId, k);
    var d = taak ? null : doelVan(doelId);
    if (!taak && !d) return;                  // doel is uit de lijst verdwenen
    gezien[doelId] = true;

    var via = b.taakId ? (KB.taakVan(b.taakId, k) || {}).naam || '' : '';
    var regel = {
      id: doelId,
      tekst: taak ? taak.naam : doelTekst(d),
      waar: taak ? 'Taak zonder doel' : (d.domein + ' \u00b7 ' + d.leerlijn),
      niveau: taak ? '' : (d.niveau || ''),
      datum: b.datum || null,
      // bij een taak staat die naam al bovenaan de regel
      viaTaak: taak ? '' : via
    };
    (b.stand === 'behaald' ? behaald : b.stand === 'bezig' ? bezig : ontdekt).push(regel);
  });

  var sorteer = function (a, b) { return (b.datum || 0) - (a.datum || 0); };
  behaald.sort(sorteer); bezig.sort(sorteer); ontdekt.sort(sorteer);

  /* Waar we nog aan gaan werken: de doelen die de groep heeft aangezet
     en waar dit kind nog niets op staat. Alleen als erom gevraagd wordt --
     anders wordt het blad een boodschappenlijst. */
  var nog = [];
  if (opties.nogNiet) {
    Object.keys(k.doelActief || {}).forEach(function (id) {
      if (!k.doelActief[id] || gezien[id]) return;
      var d = doelVan(id);
      if (d) nog.push({ id:id, tekst: doelTekst(d), waar: d.domein + ' · ' + d.leerlijn,
                        niveau: d.niveau || '' });
    });
    nog.sort(function (a, b) { return a.tekst.localeCompare(b.tekst); });
  }
  return { behaald: behaald, bezig: bezig, ontdekt: ontdekt, nog: nog };
}

function hoekenVanKind(leerlingId, k, opties){
  var r = (KBSTAT.perKind(k, opties) || {})[leerlingId];
  if (!r) return { keuzes:0, minuten:0, lijst:[], hoekenBezocht:0, deelFavoriet:0 };
  var lijst = Object.keys(r.perHoek || {}).map(function (id) {
    var h = KB.hoekVan(id, k);
    return { naam: h ? h.naam : 'een hoek die weg is', keer: r.perHoek[id] };
  }).sort(function (a, b) { return b.keer - a.keer; });
  return { keuzes: r.keuzes, minuten: r.minuten, lijst: lijst,
           hoekenBezocht: r.hoekenBezocht, deelFavoriet: r.deelFavoriet };
}

function maatjes(leerlingId, k, opties){
  return KBSTAT.maatjesVan(leerlingId, k, opties)
    .map(function (m) {
      var l = KB.leerling(m.leerlingId, k);
      return l ? { naam: l.naam, minuten: m.minuten, keren: m.keren } : null;
    })
    .filter(Boolean)
    .sort(function (a, b) { return b.minuten - a.minuten; });
}

function gegevens(leerlingId, k, opties){
  k = k || KB.klas();
  opties = opties || {};
  var l = KB.leerling(leerlingId, k);
  if (!l) return null;
  var stat = { dagen: opties.dagen || 0, eind: opties.eind || null };
  return {
    naam: l.naam,
    beeld: opties.fotos === false ? null : (l.image || null),
    doelen: doelenVanKind(leerlingId, k, opties),
    hoeken: hoekenVanKind(leerlingId, k, stat),
    maatjes: maatjes(leerlingId, k, stat),
    opval: (KBSTAT.opvallend(k, stat) || [])
             .filter(function (o) { return o.leerlingId === leerlingId; })
             .map(function (o) { return o.tekst; })
  };
}

/* ── het blad zelf ────────────────────────────────────────────── */

function veilig(t){
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function datumKort(ms){
  if (!ms) return '';
  var d = new Date(ms);
  return d.getDate() + ' ' + ['januari','februari','maart','april','mei','juni','juli',
    'augustus','september','oktober','november','december'][d.getMonth()];
}
function periodeTekst(dagen){
  if (!dagen)        return 'sinds het begin';
  if (dagen === 7)   return 'van de afgelopen week';
  if (dagen === 30)  return 'van de afgelopen maand';
  if (dagen === 90)  return 'van het afgelopen kwartaal';
  if (dagen === 180) return 'van het afgelopen half jaar';
  if (dagen % 7 === 0) return 'van de afgelopen ' + (dagen / 7) + ' weken';
  return 'van de afgelopen ' + dagen + ' dagen';
}
function minutenTekst(m){
  m = Math.round(m || 0);
  if (m < 60) return m + ' minuten';
  var u = Math.floor(m / 60), r = m % 60;
  return u + ' uur' + (r ? ' en ' + r + ' minuten' : '');
}

function doelLijstHtml(lijst, leeg){
  if (!lijst.length) return '<p class="leeg">' + veilig(leeg) + '</p>';
  return '<ul class="doelen">' + lijst.map(function (d) {
    var onder = [d.niveau ? 'groep ' + d.niveau : '', d.waar,
                 d.viaTaak ? 'bij ' + d.viaTaak : '',
                 d.datum ? datumKort(d.datum) : ''].filter(Boolean).join(' · ');
    return '<li><span class="doel">' + veilig(d.tekst) + '</span>' +
           (onder ? '<span class="bij">' + veilig(onder) + '</span>' : '') + '</li>';
  }).join('') + '</ul>';
}

function bladHtml(g, kop, opties){
  var stukken = [];
  stukken.push(
    '<header>' +
      (g.beeld ? '<img class="pasfoto" src="' + veilig(g.beeld) + '" alt="">' : '') +
      '<div><h1>' + veilig(g.naam) + '</h1>' +
      '<p class="onder">' + veilig(kop) + '</p></div>' +
    '</header>');

  stukken.push('<section><h2>Dit kan ' + veilig(g.naam) + ' zelfstandig</h2>' +
    doelLijstHtml(g.doelen.behaald,
      'Hier staat nog niets genoteerd.') + '</section>');

  stukken.push('<section><h2>Dit lukt met een beetje hulp</h2>' +
    doelLijstHtml(g.doelen.bezig,
      'Hier staat op dit moment niets genoteerd.') + '</section>');

  if (g.doelen.ontdekt.length) {
    stukken.push('<section><h2>Hier is ' + veilig(g.naam) + ' aan het ontdekken</h2>' +
      doelLijstHtml(g.doelen.ontdekt, '') + '</section>');
  }

  if (opties.nogNiet && g.doelen.nog.length) {
    stukken.push('<section><h2>Waar we nog aan gaan werken</h2>' +
      doelLijstHtml(g.doelen.nog, '') + '</section>');
  }

  if (opties.spel !== false) {
    var h = g.hoeken;
    var hoekTekst;
    if (!h.keuzes) {
      hoekTekst = '<p class="leeg">In deze periode staat er nog geen keuze op het bord.</p>';
    } else {
      hoekTekst = '<p class="zin">' + veilig(g.naam) + ' koos ' + h.keuzes + ' keer een hoek, ' +
        'samen ' + veilig(minutenTekst(h.minuten)) + ', verdeeld over ' +
        h.hoekenBezocht + ' verschillende ' + (h.hoekenBezocht === 1 ? 'hoek' : 'hoeken') + '.</p>' +
        '<ul class="hoeken">' + h.lijst.map(function (x) {
          var deel = Math.round((x.keer / h.keuzes) * 100);
          return '<li><span class="naam">' + veilig(x.naam) + '</span>' +
                 '<span class="baan"><i style="width:' + deel + '%"></i></span>' +
                 '<span class="getal">' + x.keer + '×</span></li>';
        }).join('') + '</ul>';
    }
    stukken.push('<section><h2>Waar ' + veilig(g.naam) + ' graag speelt</h2>' + hoekTekst + '</section>');

    var mt;
    if (!g.maatjes.length) {
      mt = '<p class="leeg">' + veilig(g.naam) + ' zat in deze periode niet tegelijk met ' +
           'een ander kind in dezelfde hoek.</p>';
    } else {
      mt = '<ul class="maatjes">' + g.maatjes.slice(0, 8).map(function (m) {
        return '<li><span class="naam">' + veilig(m.naam) + '</span>' +
               '<span class="bij">' + veilig(minutenTekst(m.minuten)) + ' samen, ' +
               m.keren + ' keer</span></li>';
      }).join('') + '</ul>';
    }
    stukken.push('<section><h2>Met wie ' + veilig(g.naam) + ' speelt</h2>' + mt + '</section>');
  }

  if (opties.opval !== false && g.opval.length) {
    stukken.push('<section><h2>Wat opvalt</h2><ul class="opval">' +
      g.opval.map(function (t) { return '<li>' + veilig(t) + '</li>'; }).join('') +
      '</ul></section>');
  }

  if (opties.ruimte !== false) {
    stukken.push('<section class="ruimte"><h2>Aantekeningen</h2>' +
      '<div class="lijnen"><span></span><span></span><span></span>' +
      '<span></span><span></span><span></span></div></section>');
  }

  return '<article class="blad">' + stukken.join('') + '</article>';
}

var STIJL =
'@page { size: A4 portrait; margin: 16mm 15mm; }' +
'* { box-sizing: border-box; }' +
'body { margin:0; font: 11pt/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' +
'       color:#1b1d21; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
'.blad { page-break-after: always; break-after: page; padding: 0 0 6mm; }' +
'.blad:last-child { page-break-after: auto; break-after: auto; }' +
'header { display:flex; align-items:center; gap:14px; border-bottom:2px solid #1b1d21;' +
'         padding-bottom:10px; margin-bottom:18px; }' +
'.pasfoto { width:56px; height:56px; border-radius:50%; object-fit:cover;' +
'           border:1px solid #d3d6dc; flex:0 0 auto; }' +
'h1 { margin:0; font-size:19pt; letter-spacing:-.02em; }' +
'.onder { margin:2px 0 0; font-size:9.5pt; color:#63676f; }' +
'section { margin-bottom:16px; break-inside:avoid; }' +
'h2 { margin:0 0 7px; font-size:10.5pt; text-transform:uppercase; letter-spacing:.07em;' +
'     color:#63676f; font-weight:600; }' +
'p.zin { margin:0 0 8px; }' +
'p.leeg { margin:0; color:#8b8f97; font-style:italic; }' +
'ul { list-style:none; margin:0; padding:0; }' +
'ul.doelen li { padding:5px 0 5px 16px; border-bottom:1px solid #ecedf0; position:relative; }' +
'ul.doelen li:before { content:""; position:absolute; left:0; top:11px; width:7px; height:7px;' +
'                      border-radius:50%; background:#1b1d21; }' +
'ul.doelen li:last-child { border-bottom:none; }' +
'.doel { display:block; }' +
'.bij { display:block; font-size:8.5pt; color:#7d818a; margin-top:1px; }' +
'ul.hoeken li, ul.maatjes li { display:flex; align-items:center; gap:10px; padding:3.5px 0; }' +
'ul.hoeken .naam { flex:0 0 34%; }' +
'ul.hoeken .baan { flex:1; height:8px; border-radius:4px; background:#ecedf0; overflow:hidden; }' +
'ul.hoeken .baan i { display:block; height:100%; background:#2f333a; }' +
'ul.hoeken .getal { flex:0 0 42px; text-align:right; font-variant-numeric:tabular-nums;' +
'                   font-size:9.5pt; color:#63676f; }' +
'ul.maatjes .naam { flex:0 0 34%; font-weight:600; }' +
'ul.maatjes .bij { display:inline; font-size:9.5pt; }' +
'ul.opval li { padding:3.5px 0 3.5px 22px; position:relative; }' +
'ul.opval li:before { content:"\\2014"; position:absolute; left:0; color:#8b8f97; }' +
'.ruimte .lijnen span { display:block; border-bottom:1px solid #d3d6dc; height:24px; }';

function document_(kinderen, k, opties){
  k = k || KB.klas();
  opties = opties || {};
  var kop = [k.naam || 'Onze groep',
             global.KBSTAT ? KBSTAT.periodeZin({ dagen:opties.dagen || 0, eind:opties.eind || null })
                           : periodeTekst(opties.dagen || 0),
             'opgemaakt ' + datumKort(Date.now())].join(' \u00b7 ');
  var bladen = kinderen.map(function (id) {
    var g = gegevens(id, k, opties);
    return g ? bladHtml(g, kop, opties) : '';
  }).join('');
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
         '<title>' + veilig('Verslag ' + (k.naam || '')) + '</title>' +
         '<style>' + STIJL + '</style></head><body>' + bladen + '</body></html>';
}

/* ── afdrukken ────────────────────────────────────────────────
   Een verborgen kader in plaats van een nieuw venster: dat wordt
   niet door een popupblokkeerder tegengehouden, en het scherm
   eronder blijft staan waar het stond. */
function druk(kinderen, k, opties){
  if (!kinderen || !kinderen.length) return false;
  var oud = document.getElementById('kb-drukkader');
  if (oud) oud.parentNode.removeChild(oud);

  var kader = document.createElement('iframe');
  kader.id = 'kb-drukkader';
  kader.setAttribute('aria-hidden', 'true');
  kader.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(kader);

  var d = kader.contentWindow.document;
  d.open(); d.write(document_(kinderen, k, opties)); d.close();

  var gedaan = false;
  function nu(){
    if (gedaan) return; gedaan = true;
    try {
      kader.contentWindow.focus();
      kader.contentWindow.print();
    } catch (e) { /* een browser die niet wil afdrukken laat het blad staan */ }
    setTimeout(function () {
      if (kader.parentNode) kader.parentNode.removeChild(kader);
    }, 1500);
  }
  // wachten tot de pasfoto's er staan, anders drukt hij lege rondjes af
  var beelden = d.images ? [].slice.call(d.images) : [];
  var open = beelden.filter(function (b) { return !b.complete; }).length;
  if (!open) { setTimeout(nu, 60); return true; }
  beelden.forEach(function (b) {
    if (b.complete) return;
    var af = function () { if (--open <= 0) nu(); };
    b.addEventListener('load', af); b.addEventListener('error', af);
  });
  setTimeout(nu, 4000);   // en anders drukken we het toch af
  return true;
}

global.KBVERSLAG = {
  gegevens: gegevens,
  doelenVanKind: doelenVanKind,
  hoekenVanKind: hoekenVanKind,
  maatjes: maatjes,
  html: document_,
  druk: druk
};

})(window);
