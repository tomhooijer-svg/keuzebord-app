/* ══════════════════════════════════════════════════════════════
   HET STATISTIEKENSCHERM
   Het rekenwerk staat in kb-statistiek.js; hier staat wat je ervan
   ziet. Los van het planwerk, want statistieken gaan over wat er in
   de hoeken gebeurde -- en dat hoort bij het bord.

   Dit bestand hangt zijn paneel in de schil van het beheer, net als
   het weekplan en de thema's dat doen. Zit het er niet bij, dan heeft
   die app geen statistieken, en verder verandert er niets.
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var el = BH.el, knop = BH.knop, paneel = BH.paneel;
var teken = BH.teken;

/* ══════════════════════════════════════════════════════════
   STATISTIEKEN
   Wat je in de drukte van een schooldag niet ziet: wie waar
   vaak zit, wie elkaar nooit tegenkomt, welke hoek leeg blijft.
   Geen oordeel -- tellingen. De leerkracht weet wat ze betekenen.
   ══════════════════════════════════════════════════════════ */

/* De periode waar je naar kijkt: hoe lang, en tot wanneer. Dat tweede
   is het punt -- voor een oudergesprek in januari wil je de weken vóór
   de kerstvakantie zien, niet de weken erna. */
var statPeriode = 21;      // over hoeveel dagen we kijken
var statEind = null;       // tot welke dag; leeg is vandaag
var statKind = null;       // welk kind is uitgeklapt

BH.panelen.statistiek = function (v){
  var k = KB.klas();
  var opties = { dagen: statPeriode, eind: statEind };
  var p = KBSTAT.periode(opties);

  v.appendChild(BH.kopregel('Statistieken',
    'Uit wat er op het bord gebeurde \u2014 ' + KBSTAT.periodeZin(opties),
    knop('Periode kiezen', 'stil', function () { periodeBlad(); })));
  v.appendChild(periodeBalk());

  var bezoeken = KBSTAT.bezoekjes(k, p.van, p.tot);
  if (!bezoeken.length) {
    var leegP = paneel();
    leegP.appendChild(BH.leegBericht(
      'Er is in deze periode nog niets op het bord gebeurd. Zodra de kinderen hoeken ' +
      'kiezen, staat hier wie waar vaak zit en wie met wie speelt.'));
    v.appendChild(leegP);
    return;
  }

  /* ── wat valt op ── */
  var opval = KBSTAT.opvallend(k, opties);
  if (opval.length) {
    var p0 = paneel('Wat opvalt');
    opval.slice(0, 8).forEach(function (o) {
      var rij = el('div', 'statrij');
      rij.appendChild(el('span', 'statmerk ' + o.soort, merkTeken(o.soort)));
      rij.appendChild(el('span', 'stattekst', o.tekst));
      p0.appendChild(rij);
    });
    v.appendChild(p0);
  }

  /* ── per hoek ── */
  var hoeken = KBSTAT.perHoek(k, opties);
  var hoekLijst = Object.keys(hoeken).map(function (id) { return hoeken[id]; })
    .sort(function (a, b) { return b.keuzes - a.keuzes; });
  var meest = Math.max.apply(null, hoekLijst.map(function (h) { return h.keuzes; }).concat([1]));

  var p1 = paneel('Hoe vaak elke hoek wordt gekozen');
  hoekLijst.forEach(function (h) {
    var rij = el('div', 'staafrij');
    rij.appendChild(el('div', 'staafnaam', h.naam));
    var baan = el('div', 'staafbaan');
    var vul = el('span');
    vul.style.width = Math.round((h.keuzes / meest) * 100) + '%';
    if (!h.keuzes) vul.style.background = 'var(--lijn)';
    baan.appendChild(vul);
    rij.appendChild(baan);
    rij.appendChild(el('div', 'staafgetal',
      h.keuzes + ' × · ' + h.verschillendeKinderen + ' kind' +
      (h.verschillendeKinderen === 1 ? '' : 'eren')));
    p1.appendChild(rij);
  });
  v.appendChild(p1);

  /* ── wie speelt met wie ── */
  var stellen = KBSTAT.paren(k, opties);
  var p2 = paneel('Wie speelt met wie');
  if (!stellen.length) {
    p2.appendChild(el('p', 'hint',
      'Nog geen twee kinderen tegelijk in dezelfde hoek gezien in deze periode.'));
  } else {
    p2.appendChild(el('p', 'hint',
      'Twee kinderen "speelden samen" als ze op hetzelfde moment in dezelfde hoek zaten. ' +
      'De minuten tellen mee, want een uur samen is iets anders dan vijf minuten.'));
    var meesteMin = stellen[0].minuten || 1;
    stellen.slice(0, 12).forEach(function (r) {
      var a = KB.leerling(r.a, k), b = KB.leerling(r.b, k);
      if (!a || !b) return;
      var rij = el('div', 'staafrij');
      var naam = el('div', 'staafnaam');
      naam.appendChild(BH.pictoBol(a, 22));
      naam.appendChild(BH.pictoBol(b, 22));
      naam.appendChild(el('span', null, a.naam + ' en ' + b.naam));
      rij.appendChild(naam);
      var baan = el('div', 'staafbaan');
      var vul = el('span'); vul.style.width = Math.round((r.minuten / meesteMin) * 100) + '%';
      baan.appendChild(vul); rij.appendChild(baan);
      rij.appendChild(el('div', 'staafgetal', r.minuten + ' min · ' + r.keren + ' ×'));
      p2.appendChild(rij);
    });
  }

  var nooit = KBSTAT.nooitSamen(k, opties);
  if (nooit.length) {
    var vak = el('div', 'restvak');
    vak.appendChild(el('div', 'restvak-kop', 'Kwamen elkaar nooit tegen'));
    vak.appendChild(el('p', 'hint',
      'Deze kinderen kozen allebei wel hoeken, maar nooit tegelijk dezelfde.'));
    var rij2 = el('div', 'kindrij');
    nooit.slice(0, 24).forEach(function (r) {
      var a = KB.leerling(r.a, k), b = KB.leerling(r.b, k);
      if (!a || !b) return;
      rij2.appendChild(el('div', 'kindchip', a.naam + ' · ' + b.naam));
    });
    vak.appendChild(rij2);
    if (nooit.length > 24) {
      vak.appendChild(el('p', 'hint', 'en nog ' + (nooit.length - 24) + ' paren'));
    }
    p2.appendChild(vak);
  }
  v.appendChild(p2);

  /* ── per kind ── */
  var telling = KBSTAT.perKind(k, opties);
  var p3 = paneel('Per kind');
  p3.appendChild(el('p', 'hint', 'Klik op een kind voor zijn hoeken en zijn maatjes.'));
  (k.leerlingen || []).filter(function (l) { return l.lid !== false; })
    .sort(function (a, b) { return (telling[b.id].keuzes || 0) - (telling[a.id].keuzes || 0); })
    .forEach(function (l) {
      var r = telling[l.id];
      var rij = el('button', 'kindrij-knop' + (statKind === l.id ? ' uitgeklapt' : ''));
      rij.appendChild(BH.pictoBol(l, 30));
      var tekst = el('div', 'kindrij-tekst');
      tekst.appendChild(el('div', 'rij-naam', l.naam));
      tekst.appendChild(el('div', 'rij-sub', r.keuzes
        ? r.keuzes + ' keer gekozen · ' + r.hoekenBezocht + ' verschillende hoeken' +
          (r.favoriet ? ' · vaakst ' + (KB.hoekVan(r.favoriet, k) || {}).naam : '')
        : 'nog niet gekozen in deze periode'));
      rij.appendChild(tekst);
      rij.addEventListener('click', function () {
        statKind = statKind === l.id ? null : l.id; teken();
      });
      p3.appendChild(rij);
      if (statKind === l.id) p3.appendChild(kindDetail(l, k, opties));
    });
  v.appendChild(p3);
};

/* De snelle keuzes, altijd in beeld. */
function periodeBalk(){
  var vak = paneel();
  var keuze = el('div', 'chips');
  [[7,'Een week'],[21,'Drie weken'],[42,'Zes weken'],[90,'Een kwartaal'],[0,'Alles']]
    .forEach(function (paar) {
      var c = el('button', 'chip' + (statPeriode === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () { statPeriode = paar[0]; teken(); });
      keuze.appendChild(c);
    });
  vak.appendChild(keuze);

  if (statEind) {
    var rij = el('div', 'knoprij');
    rij.appendChild(el('span', 'minichip', 'tot ' + statEind));
    rij.appendChild(knop('Terug naar vandaag', 'stil', function () { statEind = null; teken(); }));
    vak.appendChild(rij);
  }
  return vak;
}

/* En het venster waarin je hem helemaal zelf zet. */
function periodeBlad(){
  var lengte = statPeriode, eind = statEind;
  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel('Over welke periode',
      'Kies hoe lang de periode is en tot wanneer hij loopt.'));

    var v1 = el('div', 'veld');
    v1.appendChild(el('label', null, 'Hoe lang'));
    var chips = el('div', 'chips');
    [[7,'1 week'],[14,'2 weken'],[21,'3 weken'],[42,'6 weken'],
     [90,'Een kwartaal'],[180,'Een half jaar'],[0,'Alles']].forEach(function (paar) {
      var c = el('button', 'chip' + (lengte === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        lengte = paar[0];
        Array.prototype.forEach.call(chips.children, function (x) { x.classList.remove('aan'); });
        c.classList.add('aan');
        toonZin();
      });
      chips.appendChild(c);
    });
    v1.appendChild(chips);
    blad.appendChild(v1);

    var v2 = el('div', 'veld');
    v2.appendChild(el('label', null, 'Tot welke dag'));
    var datum = el('input');
    datum.type = 'date';
    datum.value = eind || '';
    datum.max = KB.datumSleutel(new Date());
    datum.addEventListener('change', function () { eind = datum.value || null; toonZin(); });
    v2.appendChild(datum);
    v2.appendChild(el('p', 'hint',
      'Laat leeg voor vandaag. Vul je hier bijvoorbeeld de laatste schooldag voor de ' +
      'kerstvakantie in, dan kijk je naar de weken daarv\u00f3\u00f3r.'));
    blad.appendChild(v2);

    var zin = el('p', 'hint');
    zin.style.cssText = 'margin:16px 0 4px;font-size:.95rem;color:var(--inkt)';
    blad.appendChild(zin);
    function toonZin(){
      zin.textContent = 'Je kijkt naar: ' + KBSTAT.periodeZin({ dagen:lengte, eind:eind }) + '.';
    }
    toonZin();

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Deze periode gebruiken', 'primair', function () {
      statPeriode = lengte; statEind = eind;
      BH.sluitBlad(); teken();
    }));
    rij.appendChild(knop('Annuleren', 'stil', BH.sluitBlad));
    blad.appendChild(rij);
  });
}

function merkTeken(soort){
  if (soort === 'vast')        return '↺';
  if (soort === 'stil')        return '!';
  if (soort === 'lege-hoek')   return '∅';
  if (soort === 'smalle-hoek') return '↓';
  if (soort === 'maatjes')     return '♥';
  if (soort === 'alleen')      return '○';
  return '·';
}

function kindDetail(l, k, opties){
  var vak = el('div', 'kinddetail');
  var telling = KBSTAT.perKind(k, opties)[l.id];

  var hoeken = Object.keys(telling.perHoek || {})
    .map(function (id) { return { id:id, n:telling.perHoek[id] }; })
    .sort(function (a, b) { return b.n - a.n; });
  if (hoeken.length) {
    vak.appendChild(el('div', 'restvak-kop', 'Hoeken'));
    var rij = el('div', 'kindrij');
    hoeken.forEach(function (h) {
      var naam = (KB.hoekVan(h.id, k) || {}).naam || 'weggehaalde hoek';
      rij.appendChild(el('div', 'kindchip', naam + ' · ' + h.n + '×'));
    });
    vak.appendChild(rij);
  }

  var maatjes = KBSTAT.maatjesVan(l.id, k, opties)
    .sort(function (a, b) { return b.minuten - a.minuten; });
  vak.appendChild(el('div', 'restvak-kop', 'Speelt samen met'));
  if (!maatjes.length) {
    vak.appendChild(el('p', 'hint',
      l.naam + ' zat in deze periode nooit tegelijk met een ander kind in dezelfde hoek.'));
  } else {
    var rij2 = el('div', 'kindrij');
    maatjes.slice(0, 10).forEach(function (m) {
      var ander = KB.leerling(m.leerlingId, k);
      if (!ander) return;
      var chip = el('div', 'kindchip');
      chip.appendChild(BH.pictoBol(ander, 22));
      chip.appendChild(el('span', null, ander.naam + ' · ' + m.minuten + ' min'));
      rij2.appendChild(chip);
    });
    vak.appendChild(rij2);
  }

  var rij3 = el('div', 'kindrij');
  rij3.style.marginTop = '10px';
  /* Het verslag voor het oudergesprek hoort bij het planwerk. Zit dat
     in dezelfde app, dan gaat het venster hier open. Zit het in de
     andere, dan brengt deze knop je erheen -- met de groep en dit kind
     mee, zodat je daar niet opnieuw hoeft te zoeken. */
  var app = window.KB_APP || {};
  var ander = (app.ander && app.apps) ? app.apps[app.ander] : null;
  if (window.KBPLAN && KBPLAN.verslagVoor) {
    rij3.appendChild(knop('Verslag van ' + l.naam, 'stil', function () {
      KBPLAN.verslagVoor(l.id);
    }));
  } else if (ander) {
    var heen = el('a', 'knop knop-stil knop-klein', 'Verslag van ' + l.naam +
                  ' in ' + ander.naam);
    heen.href = KB.appAdres(app.ander, 'beheer.html') + '#observaties';
    rij3.appendChild(heen);
  }
  vak.appendChild(rij3);
  return vak;
}

})();
