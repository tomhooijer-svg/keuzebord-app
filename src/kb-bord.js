/* ══════════════════════════════════════════════════════════════
   HET BORD
   De app die de hele dag op het digibord staat. Kiezen, timers,
   wachtrij. Verder niets — al het regelwerk zit in beheer.html.
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var $  = function (id) { return document.getElementById(id); };
var el = function (tag, klasse, tekst) {
  var n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
};
var veilig = function (s) { return String(s == null ? '' : s); };

/* Een naam die in een klein rondje past: de voornaam, en als die te lang
   is de eerste letters. Beter iets leesbaars dan een streepje. */
function kortenaam(naam){
  var delen = String(naam || '').trim().split(/\s+/);
  var n = delen[0] || '';
  // korte voornaam met nog iets erachter: dat erbij, anders staan er drie
  // keer dezelfde "Kind" naast elkaar
  if (n.length <= 4 && delen[1]) n += ' ' + delen[1].charAt(0).toUpperCase();
  return n.length > 8 ? n.slice(0, 7) + '.' : n;
}

var DAGEN   = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
var MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus',
               'september','oktober','november','december'];


/* Welke groep bij dit apparaat hoort is één afspraak, gedeeld met het
   beheer en het schoolbeheer. Stel je hem daar in, dan opent het bord
   meteen die groep. */
var OUDE_SLEUTEL = 'kb_bord_klas';   // uit een eerdere versie
var scherm = 'klassen';
var meldingTimer = null;

/* ── meldingen ───────────────────────────────────────────── */
function meld(tekst){
  var m = $('melding');
  m.textContent = tekst;
  m.classList.add('zichtbaar');
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(function () { m.classList.remove('zichtbaar'); }, 2600);
}

/* ── overlay ─────────────────────────────────────────────── */
function toonBlad(bouw){
  var blad = $('blad');
  blad.innerHTML = '';
  bouw(blad);
  $('overlay').classList.add('open');
}
function sluitBlad(){ $('overlay').classList.remove('open'); }
$('overlay').addEventListener('click', function (e) { if (e.target.id === 'overlay') sluitBlad(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluitBlad(); });

/* ── picto ───────────────────────────────────────────────── */
function maakPicto(leerling, opties){
  opties = opties || {};
  var wrap = el('div', 'picto');
  wrap.dataset.leerlingId = leerling.id;
  // de eigen kleur van het kind, zodat de gloed bij aanwijzen erbij past
  wrap.style.setProperty('--kindkleur', leerling.kleur || '#3b6ff0');
  wrap.title = leerling.naam || '';

  var rond = el('div', 'picto-rond');
  rond.style.background = leerling.kleur || '#3b6ff0';
  if (leerling.image) {
    rond.style.backgroundImage = 'url(' + leerling.image + ')';
  } else {
    rond.textContent = (leerling.naam || '?').charAt(0).toUpperCase();
  }

  if (opties.plaatsing && opties.hoek) {
    var deel = KB.timerDeel(opties.plaatsing, opties.hoek);
    var vrij = KB.vergrendeldTot(opties.plaatsing, opties.hoek) === 0;
    if (KB.instelling('timerAan')) {
      rond.appendChild(maakRing(deel));
      if (vrij) wrap.classList.add('vrij');
      else wrap.classList.add('op-slot');
    }
  }

  wrap.appendChild(rond);
  if (!opties.zonderNaam) wrap.appendChild(el('div', 'picto-naam', leerling.naam));
  return wrap;
}

function maakRing(deel){
  var straal = 46, omtrek = 2 * Math.PI * straal;
  var ring = el('div', 'ring');
  ring.innerHTML =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="baan" cx="50" cy="50" r="' + straal + '"></circle>' +
      '<circle class="voortgang" cx="50" cy="50" r="' + straal +
      '" stroke-linecap="' + (deel < 0.02 ? 'butt' : 'round') +
      '" stroke-dasharray="' + (omtrek * deel).toFixed(1) + ' ' + omtrek.toFixed(1) + '"></circle>' +
    '</svg>';
  return ring;
}

/* ── klas kiezen ─────────────────────────────────────────── */
function toonKlassen(){
  scherm = 'klassen';
  document.querySelectorAll('.scherm').forEach(function (s) { s.classList.remove('aan'); });
  $('scherm-klassen').classList.add('aan');

  pasUiterlijkToe(KB.klas());
  var rooster = $('klas-rooster');
  rooster.innerHTML = '';
  // Alleen de groepen die bij deze persoon horen. Wie is ingelogd ziet
  // hier niet de groepen die ooit alleen in deze browser zijn gemaakt --
  // die horen thuis in het schoolbeheer, niet op het digibord.
  var lijst = (window.KBV && KBV.mijnKlassen) ? KBV.mijnKlassen() : KB.G.klassen;
  lijst.forEach(function (k) {
    var kaart = el('button', 'kaart klas-kaart');
    kaart.appendChild(el('div', 'n', k.naam));
    kaart.appendChild(el('div', 's', (k.leerlingen || []).length + ' kinderen · ' +
                                     (k.hoekLib || []).length + ' hoeken'));
    kaart.addEventListener('click', function () {
      KB.zetBeheerKlas(k.id); KB.bewaar();
      toonBord();
    });
    rooster.appendChild(kaart);
  });
  tik();
}

/* ── bord ────────────────────────────────────────────────── */
function toonBord(){
  scherm = 'bord';
  document.querySelectorAll('.scherm').forEach(function (s) { s.classList.remove('aan'); });
  $('scherm-bord').classList.add('aan');
  tekenBord();
  toonAanUit();
}



function pasUiterlijkToe(k){
  try { document.body.style.background = KB.achtergrondCss(k); }
  catch (e) { /* dan blijft de standaardachtergrond staan */ }
}

/* Nog geen hoeken? Dan staat er niets om te kiezen. In plaats van een
   leeg raster zeggen we wat er moet gebeuren. */
function toonNogNiets(k){
  var rooster = $('rooster');
  rooster.innerHTML = '';
  rooster.style.gridTemplateColumns = '1fr';
  rooster.style.gridTemplateRows = '1fr';
  var vak = el('div', 'nogniets');
  vak.appendChild(el('div', 'nogniets-kop', 'Er zijn nog geen hoeken'));
  vak.appendChild(el('div', 'nogniets-sub',
    (k.leerlingen || []).length
      ? 'Zet de hoeken klaar in het beheer, dan kunnen de kinderen kiezen.'
      : 'Zet de kinderen en de hoeken klaar in het beheer.'));
  var naarBeheer = el('a', 'knop knop-primair', 'Naar het beheer');
  naarBeheer.href = 'beheer.html';
  naarBeheer.style.marginTop = '18px';
  vak.appendChild(naarBeheer);
  rooster.appendChild(vak);
  var balk = document.querySelector('.strook');
  if (balk) balk.style.display = 'none';
}

function tekenBord(){
  var k = KB.klas(), b = KB.bord(k);
  $('bord-groep').textContent = k.naam;
  pasUiterlijkToe(k);

  var hoeken = KB.bordHoeken(b, k);
  if (!hoeken.length) { toonNogNiets(k); return; }

  var balk = document.querySelector('.strook');
  if (balk) balk.style.display = '';

  var rooster = $('rooster');
  rooster.innerHTML = '';
  rooster.style.gridTemplateColumns = '';
  rooster.style.gridTemplateRows = '';
  // Eerst rekenen, dan tekenen: zo staan de kaarten meteen op hun eindmaat
  // in plaats van dat ze na het verschijnen nog een keer verspringen.
  var indeling = berekenIndeling(rooster, hoeken.length);
  hoeken.forEach(function (hoek, i) {
    rooster.appendChild(maakHoekKaart(hoek, i, k, b, indeling));
  });
  tekenStrook(k, b);
  toonAanUit();
  tik();
}

/* Wie er vandaag in de werkplaats hoort. Met werkmomenten aan komt dat in
   rondes: de eerste zes zijn nu aan de beurt, de volgende zes staan er in
   het grijs achter. Zodra iemand van ronde één zijn plaatje eruit haalt,
   schuift de naam daarachter in beeld. */
function werkplaatsRondes(hoek, k, b){
  var leeg = { nu: [], straks: [] };
  if (!hoek.werkplaats || !KB.instelling('werkplaatsAan', k)) return leeg;

  var aanwezig = KB.bezetting(hoek.id, b).map(function (p) { return p.leerlingId; });
  var dag = KB.dagVanVandaag();
  var w = KB.week(KB.weekSleutel(), k);
  var nu = [], straks = [];

  (w.taken || []).forEach(function (wt) {
    var groepen = KB.momentGroepen(wt, dag, hoek.maxKinderen, k);
    groepen.rondes.forEach(function (ronde, nr) {
      ronde.forEach(function (id) {
        if (aanwezig.indexOf(id) >= 0) return;              // die staat er al
        if (KB.geweestVandaag(wt, id)) return;              // die is al geweest
        if (nr === 0) nu.push(id); else straks.push(id);
      });
    });
    groepen.teveel.forEach(function (id) {
      if (aanwezig.indexOf(id) < 0 && !KB.geweestVandaag(wt, id)) straks.push(id);
    });
  });

  // Is ronde één op, dan schuift ronde twee door naar voren.
  return { nu: nu, straks: straks };
}


/* Het bord vult altijd het hele scherm, of je nu zes of twintig hoeken
   hebt. We zoeken de indeling waarbij de kaarten zo groot mogelijk zijn
   en niet te smal of te plat worden, en schalen daarna alles wat op de
   kaart staat mee. */
function berekenIndeling(rooster, aantal){
  if (!aantal) return null;
  var stijl = getComputedStyle(rooster);
  var doos = rooster.getBoundingClientRect();
  var breedte = doos.width - parseFloat(stijl.paddingLeft) - parseFloat(stijl.paddingRight);
  var hoogte = doos.height - parseFloat(stijl.paddingTop) - parseFloat(stijl.paddingBottom);
  if (breedte < 40 || hoogte < 40) return null;
  var tussen = 18;

  var besteKolommen = 1, besteScore = -Infinity;
  for (var kol = 1; kol <= aantal; kol++) {
    var rijen = Math.ceil(aantal / kol);
    var kb = (breedte - tussen * (kol - 1)) / kol;
    var kh = (hoogte - tussen * (rijen - 1)) / rijen;
    if (kb < 130 || kh < 110) continue;
    var verhouding = kb / kh;
    // een kaart die te smal of te breed wordt telt minder mee
    var straf = verhouding < 0.95 ? Math.pow(verhouding / 0.95, 2)
              : verhouding > 2.1  ? Math.pow(2.1 / verhouding, 2) : 1;
    var score = Math.sqrt(kb * kh) * straf;
    if (score > besteScore) { besteScore = score; besteKolommen = kol; }
  }
  var rijenNu = Math.ceil(aantal / besteKolommen);
  rooster.style.setProperty('--kolommen', besteKolommen);
  rooster.style.setProperty('--rijen', rijenNu);

  var kaartH = (hoogte - tussen * (rijenNu - 1)) / rijenNu;
  var kaartB = (breedte - tussen * (besteKolommen - 1)) / besteKolommen;

  // alles op de kaart schaalt mee met de kaartgrootte
  var maat = Math.min(kaartH, kaartB * 0.72);
  rooster.style.setProperty('--tussen', tussen + 'px');
  rooster.style.setProperty('--slot', begrens(maat * 0.20, 24, 52) + 'px');
  rooster.style.setProperty('--naamgrootte', begrens(maat * 0.115, 13, 24) + 'px');
  rooster.style.setProperty('--tellinggrootte', begrens(maat * 0.105, 12, 21) + 'px');
  rooster.style.setProperty('--icoongrootte', begrens(maat * 0.30, 26, 66) + 'px');
  rooster.style.setProperty('--beeldhoogte', begrens(kaartH * 0.46, 46, 190) + 'px');
  rooster.style.setProperty('--kaartrond', begrens(maat * 0.10, 12, 26) + 'px');
  rooster.style.setProperty('--onderpad', begrens(maat * 0.055, 8, 18) + 'px');

  /* De plekken horen op één rij te passen, ook bij een hoek met acht
     plekken naast een hoek met twee. Elke kaart rekent zijn eigen maat
     uit zodra hij gemaakt wordt. */
  var pad = begrens(maat * 0.055, 8, 18) + 4;
  return {
    ruimte: kaartB - pad * 2,
    algemeneSlot: begrens(maat * 0.20, 24, 52)
  };
}

/* De plekmaat voor één kaart: n plekken met n-1 tussenruimtes van
   0,16 keer die maat moeten samen binnen de kaart passen. */
function slotVoor(indeling, aantal){
  if (!indeling) return null;
  aantal = Math.max(1, aantal);
  var passend = Math.floor(indeling.ruimte / (aantal + 0.16 * (aantal - 1)));
  return Math.max(16, Math.min(indeling.algemeneSlot, passend));
}
function begrens(waarde, laag, hoog){ return Math.round(Math.max(laag, Math.min(hoog, waarde))); }

function maakHoekKaart(hoek, index, k, b, indeling){
  var tint = KB.hoekTinten(hoek, index);
  var kinderen = KB.bezetting(hoek.id, b);
  var gereserveerd = werkplaatsRondes(hoek, k, b);
  var vol = kinderen.length >= hoek.maxKinderen;
  var rij = KB.wachtrijVoor(hoek.id, k);

  var kaart = el('div', 'kaart hoek' + (vol ? ' vol' : ''));
  kaart.dataset.hoekId = hoek.id;
  kaart.style.setProperty('--hoekkleur', tint.kleur);
  kaart.style.setProperty('--hoektekst', tint.tekst);
  kaart.style.setProperty('--hoektint', tint.tint);
  kaart.style.setProperty('--hoekzacht', tint.zacht);
  kaart.style.setProperty('--hoekschaduw', tint.schaduw);
  var slot = slotVoor(indeling, hoek.maxKinderen);
  if (slot) kaart.style.setProperty('--slot', slot + 'px');

  var beeld = el('div', 'hoek-beeld');
  var f = KB.foto(hoek.fotoId, k);
  if (f) {
    // De foto ís de kaart: hij vult hem helemaal, en de naam komt erover.
    beeld.style.backgroundImage = 'url(' + f + ')';
    beeld.classList.add('met-foto');
    kaart.classList.add('fotohoek');
  } else {
    beeld.appendChild(hoekIcoon(tint.kleur, hoek.naam));
  }
  kaart.appendChild(beeld);

  var onder = el('div', 'hoek-onder');

  var kop = el('div', 'hoek-kop');
  kop.appendChild(el('div', 'hoek-naam', hoek.naam));
  var telling = el('div', 'hoek-telling');
  telling.appendChild(el('span', 'bezet', String(kinderen.length)));
  telling.appendChild(el('span', 'van', '/' + hoek.maxKinderen));
  kop.appendChild(telling);
  onder.appendChild(kop);

  /* Zoveel plekken als de hoek heeft — je ziet in één oogopslag
     hoeveel er zijn en hoeveel er nog vrij zijn. */
  var plekken = el('div', 'hoek-plekken');
  kinderen.forEach(function (p) {
    var l = KB.leerling(p.leerlingId, k);
    if (!l) return;
    var plek = el('div', 'plek bezet');
    var picto = maakPicto(l, { plaatsing: p, hoek: hoek, zonderNaam: true });
    picto.title = l.naam;
    maakSleepbaar(picto, l, hoek.id);
    plek.appendChild(picto);
    plekken.appendChild(plek);
  });
  var vrijeplekken = Math.max(0, hoek.maxKinderen - kinderen.length);
  var nuLijst = (gereserveerd.nu || []).slice(0, vrijeplekken);
  nuLijst.forEach(function (id) {
    var l = KB.leerling(id, k);
    if (!l) return;
    var plek = el('div', 'plek gereserveerd');
    var bol = el('div', 'picto-rond');
    bol.style.background = l.kleur || '#3b6ff0';
    if (l.image) bol.style.backgroundImage = 'url(' + l.image + ')';
    else bol.textContent = (l.naam || '?').charAt(0).toUpperCase();
    plek.appendChild(bol);
    plek.title = l.naam + ' is nu aan de beurt';
    plekken.appendChild(plek);
  });

  // Wat er nog over is aan plekken vullen we met de namen van het volgende
  // werkmoment, in het grijs. Dan zie je wie er straks aan de beurt is
  // zonder dat het lijkt alsof ze er al zitten.
  var nog = hoek.maxKinderen - kinderen.length - nuLijst.length;
  var straksLijst = (gereserveerd.straks || []).slice(0, Math.max(0, nog));
  straksLijst.forEach(function (id) {
    var l = KB.leerling(id, k);
    if (!l) return;
    var plek = el('div', 'plek straks');
    plek.appendChild(el('span', 'plek-naam', kortenaam(l.naam)));
    plek.title = l.naam + ' is het volgende werkmoment aan de beurt';
    plekken.appendChild(plek);
  });

  for (var i = kinderen.length + nuLijst.length + straksLijst.length;
       i < hoek.maxKinderen; i++) {
    plekken.appendChild(el('div', 'plek vrij'));
  }
  onder.appendChild(plekken);
  kaart.appendChild(onder);

  if (rij.length) {
    var wacht = el('div', 'wacht-merk', rij.length + ' wacht' + (rij.length === 1 ? 't' : 'en'));
    kaart.appendChild(wacht);
  } else if (gereserveerd.length) {
    kaart.appendChild(el('div', 'wacht-merk beurt', 'aan de beurt'));
  }

  kaart.addEventListener('click', function (e) {
    if (e.target.closest('.picto')) return;
    toonHoekDetail(hoek, index);
  });
  return kaart;
}

/* Eenvoudige lijntekeningen tot een groep zijn eigen hoekfoto's uploadt.
   Op naam herkend, met de blokken als terugval. */
var ICONEN = [
  { woorden:['bouw','blok','constructie'],
    pad:'<rect x="3" y="13" width="8" height="8" rx="1.5"></rect>' +
        '<rect x="13" y="13" width="8" height="8" rx="1.5"></rect>' +
        '<rect x="8" y="4" width="8" height="8" rx="1.5"></rect>' },
  { woorden:['huis','poppen','keuken'],
    pad:'<path d="M4 11 L12 4 L20 11 V20 H4 Z"></path><path d="M10 20 v-6 h4 v6"></path>' },
  { woorden:['zand','water','tafel met zand'],
    pad:'<path d="M3 15 c3 -2 5 2 9 0 c3 -1.5 6 1 9 -0.5"></path>' +
        '<path d="M8 15 V9 h8 v6"></path><path d="M6 20 h12"></path>' },
  { woorden:['knutsel','verf','schilder','teken','creatief','plak','klei'],
    pad:'<circle cx="6.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>' +
        '<path d="M8.3 15.7 L18 4"></path><path d="M15.7 15.7 L6 4"></path>' },
  { woorden:['werk','taak','opdracht','tafel'],
    pad:'<path d="M3 9 h18"></path><path d="M5 9 v11"></path><path d="M19 9 v11"></path>' +
        '<path d="M14.5 4 l4 3 -8 2.5"></path>' },
  { woorden:['lees','boek','verhaal','luister'],
    pad:'<path d="M12 7 C10 5 7 4.5 4 5 v12 c3 -.5 6 0 8 2"></path>' +
        '<path d="M12 7 C14 5 17 4.5 20 5 v12 c-3 -.5 -6 0 -8 2"></path>' },
  { woorden:['puzzel','spel','gezelschap'],
    pad:'<path d="M4 4 h6 a2 2 0 0 1 4 0 h6 v6 a2 2 0 0 0 0 4 v6 h-6 a2 2 0 0 0 -4 0 H4 v-6 ' +
        'a2 2 0 0 0 0 -4 Z"></path>' },
  { woorden:['muziek','dans','zing'],
    pad:'<path d="M9 18 V6 l10 -2 v12"></path><circle cx="6.5" cy="18" r="2.5"></circle>' +
        '<circle cx="16.5" cy="16" r="2.5"></circle>' },
  { woorden:['auto','voertuig','garage'],
    pad:'<path d="M3 15 l2-5 h14 l2 5 v4 H3 Z"></path><circle cx="7.5" cy="19" r="1.8"></circle>' +
        '<circle cx="16.5" cy="19" r="1.8"></circle>' },
  { woorden:['winkel','markt','kassa'],
    pad:'<path d="M4 8 h16 l-1.5 12 H5.5 Z"></path><path d="M9 8 V6 a3 3 0 0 1 6 0 v2"></path>' },
];

function icoonPad(naam){
  var n = (naam || '').toLowerCase();
  for (var i = 0; i < ICONEN.length; i++) {
    for (var j = 0; j < ICONEN[i].woorden.length; j++) {
      if (n.indexOf(ICONEN[i].woorden[j]) >= 0) return ICONEN[i].pad;
    }
  }
  return ICONEN[0].pad;
}

function hoekIcoon(kleur, naam, maat){
  var d = el('div');
  d.innerHTML =
    '<svg width="' + (maat || 60) + '" height="' + (maat || 60) + '" viewBox="0 0 24 24" fill="none" stroke="' +
    kleur + '" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' +
    icoonPad(naam) + '</svg>';
  return d;
}

function tekenStrook(k, b){
  var strook = $('strook');
  strook.innerHTML = '';
  var vrij = (k.leerlingen || []).filter(function (l) {
    return l.lid !== false && !KB.plaatsingVan(l.id, b);
  });
  $('strook-kop').textContent = vrij.length ? 'Nog kiezen · ' + vrij.length : 'Iedereen heeft gekozen';
  vrij.forEach(function (l) {
    var picto = maakPicto(l, {});
    maakSleepbaar(picto, l, null);
    strook.appendChild(picto);
  });
}

/* ── slepen ──────────────────────────────────────────────────
   Op een digibord staan vaak meerdere kinderen tegelijk te slepen.
   Elke aanraking krijgt daarom zijn eigen sleep, herkenbaar aan het
   pointerId. De luisteraars staan op het document en filteren op dat
   id, zodat een sleep blijft werken ook als het bord ondertussen
   opnieuw wordt getekend doordat een ander kind zijn keuze maakt. */
var lopendeSlepen = 0;
var slependeKinderen = {};      // leerlingId -> true, om dubbel pakken te weren
window.KB_SLEEP_STATUS = function () {
  return { lopend: lopendeSlepen, kinderen: Object.keys(slependeKinderen) };
};

function maakSleepbaar(picto, leerling, vanHoekId){
  picto.addEventListener('pointerdown', function (start) {
    if (start.button != null && start.button !== 0) return;
    // Twee vingers op hetzelfde kind is één sleep, geen twee.
    if (slependeKinderen[leerling.id]) return;

    // Zit dit kind nog vast, dan mag het niet weg.
    if (vanHoekId) {
      var b = KB.bord(), plaatsing = (b.plaatsingen[vanHoekId] || []).filter(function (p) {
        return p.leerlingId === leerling.id;
      })[0];
      var hoek = KB.hoekVan(vanHoekId);
      if (plaatsing) {
        var rest = KB.vergrendeldTot(plaatsing, hoek);
        if (rest > 0) { toonNogEven(leerling, hoek, rest); return; }
      }
    }

    start.preventDefault();
    var pid = start.pointerId;
    lopendeSlepen++;
    slependeKinderen[leerling.id] = true;

    // Alleen de bol meenemen, niet de naam eronder: dat leest als een
    // kaartje dat je optilt in plaats van als een stukje tekst.
    var bron = picto.querySelector('.picto-rond');
    var maat = bron ? bron.getBoundingClientRect().width : 60;
    var geest = document.createElement('div');
    geest.className = 'sleep-geest';
    var bol = bron.cloneNode(true);
    var ring = bol.querySelector('.ring');
    if (ring) ring.remove();                 // de timer hoort bij de hoek, niet bij je hand
    bol.style.width = bol.style.height = maat + 'px';
    geest.appendChild(bol);
    geest.style.left = start.clientX + 'px';
    geest.style.top  = start.clientY + 'px';
    document.body.appendChild(geest);
    // eerst op ware grootte tekenen, dan optillen — anders slaat de
    // browser de overgang over
    requestAnimationFrame(function () { geest.classList.add('opgetild'); });
    picto.classList.add('sleept');

    var laatsteDoel = null;
    function beweeg(e){
      if (e.pointerId !== pid) return;
      geest.style.left = e.clientX + 'px';
      geest.style.top  = e.clientY + 'px';
      geest.style.display = 'none';
      var onder = document.elementFromPoint(e.clientX, e.clientY);
      geest.style.display = '';
      var kaart = onder && onder.closest ? onder.closest('.hoek') : null;
      if (kaart !== laatsteDoel) {
        if (laatsteDoel) laatsteDoel.classList.remove('doelwit');
        if (kaart) kaart.classList.add('doelwit');
        laatsteDoel = kaart;
      }
    }
    function los(e){
      if (e.pointerId !== pid) return;
      document.removeEventListener('pointermove', beweeg);
      document.removeEventListener('pointerup', los);
      document.removeEventListener('pointercancel', los);
      lopendeSlepen = Math.max(0, lopendeSlepen - 1);
      delete slependeKinderen[leerling.id];
      picto.classList.remove('sleept');
      if (laatsteDoel) laatsteDoel.classList.remove('doelwit');

      var onder = document.elementFromPoint(e.clientX, e.clientY);
      var kaart = onder && onder.closest ? onder.closest('.hoek') : null;

      if (kaart) {
        // even naar het midden van de hoek toe zakken voordat het bord
        // opnieuw tekent: dat leest als "hij is er"
        var doos = kaart.getBoundingClientRect();
        geest.classList.remove('opgetild');
        geest.classList.add('landt');
        geest.style.left = (doos.left + doos.width / 2) + 'px';
        geest.style.top  = (doos.top + doos.height / 2) + 'px';
        setTimeout(function () {
          geest.remove();
          leg(leerling, kaart.dataset.hoekId);
        }, 170);
      } else {
        geest.classList.add('valt-terug');
        setTimeout(function () { geest.remove(); tekenBord(); }, 150);
      }
    }
    document.addEventListener('pointermove', beweeg);
    document.addEventListener('pointerup', los);
    document.addEventListener('pointercancel', los);
  });
}

function leg(leerling, hoekId){
  var k = KB.klas(), b = KB.bord(k);
  var hoek = KB.hoekVan(hoekId, k);

  // Staat er vandaag een groepje ingepland in de werkplaats, dan zijn de
  // plekken van hen. Een ander kind mag alleen bij wat overblijft.
  if (hoek && hoek.werkplaats && KB.instelling('werkplaatsAan', k)) {
    var rondes = werkplaatsRondes(hoek, k, b);
    var isAanDeBeurt = KB.heeftBeurtVandaag(leerling.id, k);
    var bezet = KB.bezetting(hoek.id, b).length;
    // Alleen wie nú aan de beurt is houdt een plek bezet. Wie in het
    // volgende werkmoment staat, blokkeert niets -- die naam staat er
    // alleen alvast.
    if (!isAanDeBeurt && bezet + rondes.nu.length >= hoek.maxKinderen) {
      toonBeurtUitleg(leerling, hoek, rondes.nu, k);
      return;
    }
  }

  var uitkomst = KB.plaats(leerling.id, hoekId);
  if (uitkomst.ok) {
    tekenBord();
    meld(leerling.naam + ' → ' + uitkomst.hoek.naam);
    return;
  }
  if (uitkomst.reden === 'vol') {
    if (KB.instelling('wachtrijAan')) toonWachtrij(leerling, uitkomst.hoek);
    else meld(uitkomst.hoek.naam + ' is vol');
    tekenBord();
    return;
  }
  if (uitkomst.reden === 'vergrendeld') {
    var h = KB.hoekVan(KB.plaatsingVan(leerling.id).hoekId);
    toonNogEven(leerling, h, uitkomst.restMs);
    return;
  }
  tekenBord();
}

/* ── "nog even" ──────────────────────────────────────────── */
function minutenTekst(ms){
  var m = Math.ceil(ms / 60000);
  return m <= 1 ? 'nog even' : 'nog ' + m + ' minuten';
}
function toonNogEven(leerling, hoek, restMs){
  toonBlad(function (blad) {
    var kop = el('div', 'detail-kop');
    var plaatsing = (KB.bord().plaatsingen[hoek.id] || []).filter(function (p) {
      return p.leerlingId === leerling.id;
    })[0] || { startTijd: Date.now() };
    var picto = maakPicto(leerling, { plaatsing: plaatsing, hoek: hoek, zonderNaam: true });
    picto.querySelector('.picto-rond').style.width = '84px';
    picto.querySelector('.picto-rond').style.height = '84px';
    picto.querySelector('.picto-rond').style.fontSize = '2rem';
    kop.appendChild(picto);
    var tekst = el('div');
    tekst.appendChild(el('div', null, leerling.naam)).style.cssText =
      'font-size:1.5rem;font-weight:600;letter-spacing:-.02em;margin-bottom:4px';
    tekst.appendChild(el('div', null, 'Je speelt in de ' + hoek.naam.toLowerCase() + '.')).style.cssText =
      'font-size:1.05rem;color:var(--inkt-2)';
    kop.appendChild(tekst);
    blad.appendChild(kop);

    var uitleg = el('div');
    uitleg.style.cssText = 'font-size:1.15rem;color:var(--inkt);line-height:1.5;margin-bottom:24px';
    uitleg.textContent = 'Als het rondje vol is, mag je naar een andere hoek. Dat duurt ' +
                         minutenTekst(restMs) + '.';
    blad.appendChild(uitleg);

    var knop = el('button', 'knop knop-primair knop-groot', 'Oké');
    knop.addEventListener('click', sluitBlad);
    blad.appendChild(knop);
  });
}

function toonBeurtUitleg(leerling, hoek, gereserveerd, k){
  toonBlad(function (blad) {
    blad.style.textAlign = 'center';
    var titel = el('div', null, 'De werkplaats is vandaag bezet');
    titel.style.cssText = 'font-size:1.5rem;font-weight:600;letter-spacing:-.02em;margin-bottom:10px';
    blad.appendChild(titel);
    var namen = gereserveerd.map(function (id) {
      var l = KB.leerling(id, k); return l ? l.naam : null;
    }).filter(Boolean);
    var sub = el('div', null, namen.length
      ? 'Vandaag zijn ' + namen.join(', ') + ' aan de beurt. Jij komt op een andere dag.'
      : 'Vandaag is er geen plek meer. Je komt op een andere dag aan de beurt.');
    sub.style.cssText = 'font-size:1.05rem;color:var(--inkt-2);line-height:1.5;max-width:34ch;margin:0 auto 24px';
    blad.appendChild(sub);
    var k2 = el('button', 'knop knop-primair knop-groot', 'Andere hoek kiezen');
    k2.addEventListener('click', function () { sluitBlad(); tekenBord(); });
    blad.appendChild(k2);
  });
}

/* ── wachtrij ────────────────────────────────────────────── */
function toonWachtrij(leerling, hoek){
  toonBlad(function (blad) {
    blad.style.textAlign = 'center';

    var icoon = el('div');
    icoon.style.cssText = 'width:92px;height:92px;border-radius:30px;background:var(--vlak-2);' +
                          'display:flex;align-items:center;justify-content:center;margin:0 auto 22px';
    icoon.appendChild(hoekIcoon('#3b6ff0', hoek.naam, 50));
    blad.appendChild(icoon);

    var titel = el('div', null, 'De ' + hoek.naam.toLowerCase() + ' is even vol');
    titel.style.cssText = 'font-size:1.6rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(titel);

    var sub = el('div', null, 'Wil je wachten tot er een plekje vrijkomt?');
    sub.style.cssText = 'font-size:1.05rem;color:var(--inkt-2);margin-bottom:8px';
    blad.appendChild(sub);

    var knoppen = el('div');
    knoppen.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:26px;flex-wrap:wrap';

    var jaWachten = el('button', 'knop knop-primair knop-groot', 'Ik wacht');
    jaWachten.addEventListener('click', function () {
      var plek = KB.inWachtrij(leerling.id, hoek.id);
      sluitBlad(); tekenBord();
      toonPlekInRij(leerling, hoek, plek);
    });
    var anders = el('button', 'knop knop-stil knop-groot', 'Andere hoek kiezen');
    anders.addEventListener('click', function () { sluitBlad(); tekenBord(); });

    knoppen.appendChild(jaWachten);
    knoppen.appendChild(anders);
    blad.appendChild(knoppen);
  });
}

function toonPlekInRij(leerling, hoek, plek){
  toonBlad(function (blad) {
    blad.style.textAlign = 'center';
    var titel = el('div', null, 'Je staat in de rij');
    titel.style.cssText = 'font-size:1.6rem;font-weight:600;letter-spacing:-.02em;margin-bottom:6px';
    blad.appendChild(titel);
    var sub = el('div', null, 'Komt er een plekje vrij in de ' + hoek.naam.toLowerCase() +
                              ', dan ben jij aan de beurt.');
    sub.style.cssText = 'font-size:1.05rem;color:var(--inkt-2)';
    blad.appendChild(sub);

    var k = KB.klas();
    var rij = KB.wachtrijVoor(hoek.id, k);
    var strip = el('div', 'rij-wacht');
    rij.forEach(function (w, i) {
      var l = KB.leerling(w.leerlingId, k);
      if (!l) return;
      var ikzelf = l.id === leerling.id;
      var plekje = el('div', 'rij-plek' + (ikzelf ? ' ikzelf' : ''));
      plekje.appendChild(el('div', 'rij-nummer', String(i + 1)));
      var picto = maakPicto(l, { zonderNaam: true });
      if (ikzelf) {
        var houder = el('div', 'rij-ring');
        houder.appendChild(picto);
        plekje.appendChild(houder);
      } else {
        plekje.appendChild(picto);
      }
      plekje.appendChild(el('div', 'picto-naam', l.naam));
      if (ikzelf) {
        var jij = el('div', null, 'Dat ben jij');
        jij.style.cssText = 'font-size:.85rem;color:var(--accent);font-weight:600';
        plekje.appendChild(jij);
      }
      strip.appendChild(plekje);
    });
    blad.appendChild(strip);

    var knop = el('button', 'knop knop-primair knop-groot', 'Oké');
    knop.addEventListener('click', sluitBlad);
    blad.appendChild(knop);
  });
}

/* ── hoekdetail ──────────────────────────────────────────── */
function toonHoekDetail(hoek, index){
  toonBlad(function (blad) {
    var k = KB.klas(), b = KB.bord(k), tint = KB.hoekTinten(hoek, index);
    var kinderen = KB.bezetting(hoek.id, b);

    var kop = el('div', 'detail-kop');
    var icoon = el('div', 'detail-icoon');
    var f = KB.foto(hoek.fotoId, k);
    if (f) icoon.style.backgroundImage = 'url(' + f + ')';
    else { icoon.style.background = tint.tint; icoon.appendChild(hoekIcoon(tint.kleur, hoek.naam, 34)); }
    kop.appendChild(icoon);

    var tekst = el('div');
    var naam = el('div', null, hoek.naam);
    naam.style.cssText = 'font-size:1.6rem;font-weight:600;letter-spacing:-.02em';
    var sub = el('div', null, kinderen.length + ' van de ' + hoek.maxKinderen + ' plekken bezet');
    sub.style.cssText = 'font-size:1rem;color:var(--inkt-3)';
    tekst.appendChild(naam); tekst.appendChild(sub);
    kop.appendChild(tekst);
    blad.appendChild(kop);

    var plekken = el('div', 'detail-plekken');
    kinderen.forEach(function (p) {
      var l = KB.leerling(p.leerlingId, k);
      if (!l) return;
      var vak = el('div', 'detail-plek');
      vak.appendChild(maakPicto(l, { plaatsing: p, hoek: hoek, zonderNaam: true }));
      vak.appendChild(el('div', 'picto-naam', l.naam));
      var rest = KB.vergrendeldTot(p, hoek);
      var stand = el('div', 'detail-stand' + (rest === 0 ? ' vrij' : ''));
      if (!KB.instelling('timerAan'))  stand.textContent = 'Speelt hier';
      else if (rest === 0)             stand.textContent = 'Mag wisselen';
      else                             stand.textContent = minutenTekst(rest);
      vak.appendChild(stand);
      plekken.appendChild(vak);
    });
    for (var i = kinderen.length; i < hoek.maxKinderen; i++) {
      var leeg = el('div', 'detail-plek');
      var cirkel = el('div', 'detail-leeg');
      cirkel.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" ' +
        'stroke="rgba(20,28,44,.22)" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<path d="M12 5 v14"></path><path d="M5 12 h14"></path></svg>';
      leeg.appendChild(cirkel);
      leeg.appendChild(el('div', 'picto-naam', 'Vrij'));
      plekken.appendChild(leeg);
    }
    blad.appendChild(plekken);

    var rij = KB.wachtrijVoor(hoek.id, k);
    if (rij.length) {
      var wacht = el('div');
      wacht.style.cssText = 'margin-top:24px;padding-top:18px;border-top:1px solid var(--lijn);' +
                            'font-size:.95rem;color:var(--inkt-2)';
      wacht.textContent = 'In de rij: ' + rij.map(function (w) {
        var l = KB.leerling(w.leerlingId, k); return l ? l.naam : '?';
      }).join(', ');
      blad.appendChild(wacht);
    }

    var knop = el('button', 'knop knop-stil knop-groot', 'Sluiten');
    knop.style.marginTop = '26px';
    knop.addEventListener('click', sluitBlad);
    blad.appendChild(knop);
  });
}

/* ── het codeslot ─────────────────────────────────────────
   De instellingen zitten achter een code van vier cijfers, zodat een kind
   niet per ongeluk het bord leegmaakt. De juf typt hem op het digibord,
   dus grote toetsen en geen toetsenbord. */

function vraagPin(klaar){
  if (!KB.instelling('pinAan')) { klaar(); return; }
  var goed = String(KB.instelling('pincode') || '1234');
  var ingetikt = '';

  toonBlad(function (blad) {
    var vak = el('div', 'pinvak');
    var titel = el('div', null, 'Even je code');
    titel.style.cssText = 'font-size:1.3rem;font-weight:600;letter-spacing:-.022em';
    vak.appendChild(titel);
    vak.appendChild(el('p', 'hint', 'Vier cijfers.'));

    var bollen = el('div', 'pincijfers');
    for (var i = 0; i < 4; i++) bollen.appendChild(el('div', 'pincijfer'));
    vak.appendChild(bollen);

    var mis = el('div', 'pinmis');
    vak.appendChild(mis);

    function tekenBollen(){
      for (var i = 0; i < bollen.children.length; i++) {
        bollen.children[i].classList.toggle('vol', i < ingetikt.length);
      }
    }

    var toetsen = el('div', 'pintoetsen');
    ['1','2','3','4','5','6','7','8','9','','0','\u232b'].forEach(function (teken) {
      if (teken === '') { toetsen.appendChild(el('div', 'pintoets leeg')); return; }
      var t = el('button', 'pintoets', teken);
      t.addEventListener('click', function () {
        if (teken === '\u232b') ingetikt = ingetikt.slice(0, -1);
        else if (ingetikt.length < 4) ingetikt += teken;
        tekenBollen();
        if (ingetikt.length < 4) { mis.textContent = ''; return; }
        if (ingetikt === goed) { sluitBlad(); klaar(); return; }
        mis.textContent = 'Dat is niet de goede code.';
        ingetikt = '';
        setTimeout(tekenBollen, 240);
      });
      toetsen.appendChild(t);
    });
    vak.appendChild(toetsen);
    tekenBollen();

    var annuleer = el('button', 'knop knop-stil', 'Terug naar het bord');
    annuleer.style.marginTop = '22px';
    annuleer.addEventListener('click', sluitBlad);
    vak.appendChild(annuleer);
    blad.appendChild(vak);
  });
}

/* ── het bord aan- en uitzetten ───────────────────────────
   Tussen twee speelmomenten door hoeft er niets te gebeuren. Uit betekent:
   alles blijft staan zoals het staat, maar er valt niets te slepen. */

function bordStaatAan(){
  var b = KB.bord();
  return !b || b.aan !== false;      // standaard aan
}

function zetBordAan(aan){
  var b = KB.bord();
  if (b) { b.aan = !!aan; KB.bewaar(); }
  toonAanUit();
  meld(aan ? 'Het bord staat aan' : 'Het bord staat uit');
}

function toonAanUit(){
  var aan = bordStaatAan();
  var knop = $('knop-aanuit');
  if (knop) {
    knop.classList.toggle('uit', !aan);
    var tekst = $('knop-aanuit-tekst');
    if (tekst) tekst.textContent = aan ? 'Bord aan' : 'Bord uit';
  }
  var scherm = $('scherm-bord');
  if (scherm) scherm.classList.toggle('gepauzeerd', !aan);
  var vlak = $('pauzevlak');
  if (vlak) vlak.classList.toggle('aan', !aan && scherm && scherm.classList.contains('aan'));
}

/* ── menu ────────────────────────────────────────────────── */
/* Het testbord gebruikt hetzelfde bestand maar heeft niet alle knoppen,
   dus we kijken eerst of ze er zijn. */
(function () {
  var aanuit = $('knop-aanuit');
  if (aanuit) aanuit.addEventListener('click', function () { zetBordAan(!bordStaatAan()); });
  var menu = $('knop-menu');
  if (menu) menu.addEventListener('click', function () { vraagPin(toonMenu); });
})();

function toonMenu(){
  toonBlad(function (blad) {
    var titel = el('div', null, 'Bord');
    titel.style.cssText = 'font-size:1.4rem;font-weight:600;letter-spacing:-.02em;margin-bottom:20px';
    blad.appendChild(titel);

    var lijst = el('div');
    lijst.style.cssText = 'display:flex;flex-direction:column;gap:10px';

    [[bordStaatAan() ? 'Bord uitzetten' : 'Bord aanzetten', function () {
        zetBordAan(!bordStaatAan()); sluitBlad();
      }],
     ['Bord leegmaken', function () {
        var b = KB.bord(), k = KB.klas();
        Object.keys(b.plaatsingen).forEach(function (h) { b.plaatsingen[h] = []; });
        k.wachtrij = [];
        b.laatstGeleegd = Date.now();
        KB.bewaar(); sluitBlad(); tekenBord(); meld('Bord leeggemaakt');
      }],
     ['Volledig scherm', function () {
        sluitBlad();
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(function () {});
        } else if (document.exitFullscreen) { document.exitFullscreen().catch(function () {}); }
      }]
    ].forEach(function (paar) {
      var knop = el('button', 'knop knop-stil', paar[0]);
      knop.addEventListener('click', paar[1]);
      lijst.appendChild(knop);
    });

    var beheer = el('a', 'knop knop-primair', 'Naar beheer');
    beheer.href = 'beheer.html';
    lijst.appendChild(beheer);
    blad.appendChild(lijst);

    // Uitloggen kan, maar zonder naambordje erboven: op een digibord in de
    // klas hoeft niemand te zien wie er is ingelogd.
    if (window.KBV && KBV.wie() && KBV.wie().profiel) {
      var voet = el('div');
      voet.style.cssText = 'margin-top:22px;padding-top:16px;border-top:1px solid var(--vlak-2)';
      var uit = el('button', 'knop knop-stil', 'Uitloggen');
      uit.addEventListener('click', function () { sluitBlad(); KBV.afmelden(); });
      voet.appendChild(uit);
      blad.appendChild(voet);
    }
  });
}

/* ── klok en timers ──────────────────────────────────────── */
/* Elke seconde dezelfde tekst opnieuw zetten laat de browser telkens
   opnieuw rekenen. We schrijven alleen als er echt iets verandert. */
var vorigeDatum = null, vorigeTijd = null;
function zetTekst(id, tekst){
  var n = $(id);
  if (n && n.textContent !== tekst) n.textContent = tekst;
}
function tik(){
  var nu = new Date();
  var datum = DAGEN[nu.getDay()] + ' ' + nu.getDate() + ' ' + MAANDEN[nu.getMonth()];
  var tijd  = String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0');
  if (datum === vorigeDatum && tijd === vorigeTijd) return;
  vorigeDatum = datum; vorigeTijd = tijd;
  zetTekst('bord-datum', datum);
  zetTekst('bord-klok', tijd);
  zetTekst('klas-datum', datum + ' · ' + tijd);
}

/* Elke seconde de ringen bijwerken zonder het hele bord opnieuw te tekenen:
   anders knippert het scherm en verlies je een sleep die bezig is. */
function ververTimers(){
  if (scherm !== 'bord') return;
  var k = KB.klas(), b = KB.bord(k);
  var vrijgekomen = [];
  document.querySelectorAll('.hoek').forEach(function (kaart) {
    var hoek = KB.hoekVan(kaart.dataset.hoekId, k);
    if (!hoek) return;
    kaart.querySelectorAll('.picto').forEach(function (picto) {
      var p = (b.plaatsingen[hoek.id] || []).filter(function (x) {
        return x.leerlingId === picto.dataset.leerlingId;
      })[0];
      if (!p) return;
      var boog = picto.querySelector('.voortgang');
      if (!boog) return;
      var straal = 46, omtrek = 2 * Math.PI * straal;
      var deel = KB.timerDeel(p, hoek);
      boog.setAttribute('stroke-linecap', deel < 0.02 ? 'butt' : 'round');
      boog.setAttribute('stroke-dasharray',
        (omtrek * deel).toFixed(1) + ' ' + omtrek.toFixed(1));
      var wasVast = picto.classList.contains('op-slot');
      if (wasVast && KB.vergrendeldTot(p, hoek) === 0) {
        picto.classList.remove('op-slot');
        picto.classList.add('vrij');
        var l = KB.leerling(p.leerlingId, k);
        if (l) vrijgekomen.push(l.naam);
      }
    });
  });
  if (vrijgekomen.length) meld(vrijgekomen.join(' en ') + ' mag wisselen');
}

/* ── opstarten ───────────────────────────────────────────── */
KB.laad();
/* Eerst de doelenlijst en de verbinding: die haalt de groep van dit
   apparaat binnen. Lukt dat niet, dan tekent het bord gewoon wat er in de
   browser staat. */
KB.doelenZorg()
  .then(function () { return window.KBV ? KBV.zodraKlaar() : { lokaal:true }; })
  .then(function () { return KB.fkLees(); })
  .then(function (kluis) { if (kluis) { KB.fkPasToe(kluis); } })
  .catch(function () { /* zonder foto's werkt het bord gewoon */ })
  .then(function () {
    // Dit apparaat draait meestal altijd dezelfde groep. Is er ooit een
    // groep gekozen, dan gaan we daar direct heen — een digibord hoort na
    // een herstart gewoon weer het bord te tonen.
    var onthouden = KB.beheerKlasId();
    if (!onthouden) {
      // een apparaat dat nog op de oude manier was ingesteld
      try {
        var oud = localStorage.getItem(OUDE_SLEUTEL);
        if (oud && KB.G.klassen.some(function (k) { return k.id === oud; })) {
          KB.zetBeheerKlas(oud);
          localStorage.removeItem(OUDE_SLEUTEL);
          onthouden = oud;
        }
      } catch (e) {}
    }
    var bestaat = !!onthouden;
    if (bestaat) { KB.G.activeKlasId = onthouden; KB.bewaar(); }

    // Heeft deze persoon maar één groep, dan valt er niets te kiezen.
    var mijn = (window.KBV && KBV.mijnKlassen) ? KBV.mijnKlassen() : KB.G.klassen;
    if (!bestaat && mijn.length === 1) {
      KB.zetBeheerKlas(mijn[0].id);
      KB.G.activeKlasId = mijn[0].id;
      KB.bewaar();
      onthouden = mijn[0].id;
      bestaat = true;
    }

    var k = KB.klas();
    // Nieuwe dag of nieuw dagdeel? Dan begint het bord blanco.
    if (KB.moetLegen(k)) {
      var opgeruimd = KB.leegBord(k);
      if (opgeruimd) setTimeout(function () {
        meld('Nieuwe start — iedereen mag opnieuw kiezen');
      }, 900);
    }
    // Eén groep is geen keuze, en een groep zonder hoeken ook niet. In
    // beide gevallen gaan we gewoon naar het bord; dat zegt zelf wel wat
    // er nog moet gebeuren. Kiezen doe je alleen als er echt iets te
    // kiezen valt.
    if (bestaat || mijn.length === 1) toonBord();
    else toonKlassen();
    setInterval(tik, 1000);
    setInterval(ververTimers, 1000);
    var traag = null;
    window.addEventListener('resize', function () {
      clearTimeout(traag);
      traag = setTimeout(function () { if (scherm === 'bord') tekenBord(); }, 180);
    });
  });

})();
