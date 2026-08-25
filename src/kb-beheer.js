/* ══════════════════════════════════════════════════════════════
   BEHEER — schil en basispanelen
   De panelen rond de werkwijze (doelen, taken, week, observaties)
   staan in kb-plan.js en melden zich hier aan.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
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
  var m = $('melding'); if (!m) return;
  m.textContent = t; m.classList.add('zichtbaar');
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(function () { m.classList.remove('zichtbaar'); }, 2800);
}
function bewaarOfKlaag(){ if (!KB.bewaar()) meld('De opslag van deze browser zit vol'); }

/* ── overlay ─────────────────────────────────────────────── */
/* Dialogen kunnen over elkaar heen staan — een taak bewerken en daarin
   doelen kiezen. Daarom een stapel: sluiten brengt je terug naar wat
   eronder lag, en dat wordt opnieuw getekend uit de eigen gegevens. */
var bladStapel = [];
function tekenBlad(){
  var boven = bladStapel[bladStapel.length - 1];
  if (!boven) { $('overlay').classList.remove('open'); return; }
  var blad = leeg($('blad'));
  blad.style.maxWidth = boven.breed ? '860px' : '';
  blad.style.textAlign = '';
  boven.bouw(blad);
  $('overlay').classList.add('open');
}
function toonBlad(bouw, breed){
  bladStapel.push({ bouw: bouw, breed: breed });
  tekenBlad();
}
function sluitBlad(){ bladStapel.pop(); tekenBlad(); }

function vraagBevestiging(titel, uitleg, knoptekst, doen){
  toonBlad(function (blad) {
    blad.appendChild(bladTitel(titel));
    blad.appendChild(el('p', 'hint', uitleg)).style.marginBottom = '22px';
    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop(knoptekst, 'gevaar', function () { sluitBlad(); doen(); }));
    blad.appendChild(rij);
  });
}
function bladTitel(t, sub){
  var wrap = el('div');
  wrap.style.marginBottom = '18px';
  var n = el('div', null, t);
  n.style.cssText = 'font-size:1.3rem;font-weight:600;letter-spacing:-.02em';
  wrap.appendChild(n);
  if (sub) wrap.appendChild(el('div', 'hint', sub));
  return wrap;
}

/* ── bouwstenen ──────────────────────────────────────────── */
function paneel(kop, actie){
  var p = el('div', 'paneel');
  if (kop) {
    var r = el('div');
    r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';
    r.appendChild(el('div', 'paneelkop', kop)).style.marginBottom = '0';
    if (actie) r.appendChild(actie);
    p.appendChild(r);
  }
  return p;
}
function knop(tekst, soort, doen){
  var b = el('button', 'knop knop-' + (soort || 'stil') + ' knop-klein', tekst);
  b.addEventListener('click', doen);
  return b;
}
function schakelaar(aan, bijWissel){
  var s = el('div', 'schakel' + (aan ? ' aan' : ''));
  s.setAttribute('role', 'switch');
  s.setAttribute('tabindex', '0');
  s.setAttribute('aria-checked', aan ? 'true' : 'false');
  s.appendChild(el('div', 'knopje'));
  function wissel(){
    var nieuw = !s.classList.contains('aan');
    s.classList.toggle('aan', nieuw);
    s.setAttribute('aria-checked', nieuw ? 'true' : 'false');
    bijWissel(nieuw);
  }
  s.addEventListener('click', wissel);
  s.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); wissel(); }
  });
  return s;
}
function teller(waarde, min, max, bijWijziging){
  var t = el('div', 'teller');
  var m = el('button', null, '−'), w = el('div', 'w', String(waarde)), p = el('button', null, '+');
  function zet(n){
    n = Math.max(min, Math.min(max, n));
    w.textContent = String(n); bijWijziging(n);
  }
  m.addEventListener('click', function () { zet(parseInt(w.textContent, 10) - 1); });
  p.addEventListener('click', function () { zet(parseInt(w.textContent, 10) + 1); });
  t.appendChild(m); t.appendChild(w); t.appendChild(p);
  return t;
}
function pictoBol(l, maat){
  var rond = el('div', 'picto-rond');
  maat = maat || 54;
  rond.style.width = rond.style.height = maat + 'px';
  rond.style.fontSize = Math.round(maat * 0.42) + 'px';
  rond.style.background = (l && l.kleur) || '#3b6ff0';
  if (l && l.image) rond.style.backgroundImage = 'url(' + l.image + ')';
  else rond.textContent = ((l && l.naam) || '?').charAt(0).toUpperCase();
  return rond;
}
function kindKaart(l, maat, bijKlik){
  var kaart = el('button', 'leerlingkaart');
  kaart.appendChild(pictoBol(l, maat || 54));
  kaart.appendChild(el('div', 'picto-naam', l.naam));
  if (bijKlik) kaart.addEventListener('click', function () { bijKlik(l); });
  return kaart;
}
function kopregel(titel, sub, actie){
  var k = el('div', 'kopregel');
  var links = el('div');
  links.appendChild(el('div', 'titel', titel));
  if (sub) links.appendChild(el('div', 'ondertitel', sub));
  k.appendChild(links);
  if (actie) {
    var rechts = el('div', 'knoprij');
    (Array.isArray(actie) ? actie : [actie]).forEach(function (a) { rechts.appendChild(a); });
    k.appendChild(rechts);
  }
  return k;
}
function leegBericht(tekst, actie){
  var v = el('div', 'leegvak');
  v.appendChild(el('p', 'hint', tekst));
  if (actie) { actie.style.marginTop = '12px'; v.appendChild(actie); }
  return v;
}
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

/* ── menu ────────────────────────────────────────────────── */
var ONDERDELEN = [
  { id:'vandaag',    naam:'Vandaag',    icoon:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"></rect><path d="M3.5 10 h17"></path><path d="M8 3.5 v3"></path><path d="M16 3.5 v3"></path>' },
  { id:'week',       naam:'Weekplan',   icoon:'<rect x="3" y="4.5" width="18" height="16" rx="2.4"></rect><path d="M8 9 v8"></path><path d="M13 9 v8"></path><path d="M18 9 v8"></path>' },
  { id:'taken',      naam:'Taken',      icoon:'<rect x="5" y="4" width="14" height="17" rx="2.2"></rect><path d="M9 3 h6 v3 H9 Z"></path><path d="M9 13 l2 2 4-4.5"></path>' },
  { id:'doelen',     naam:'Doelen',     icoon:'<circle cx="12" cy="12" r="8.2"></circle><circle cx="12" cy="12" r="4.4"></circle>' },
  { id:'observaties',naam:'Observaties',icoon:'<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3"></rect><path d="M8 12.4 l2.6 2.6 5.4-6"></path>' },
  { id:'scheiding1', scheiding:true },
  { id:'leerlingen', naam:'Leerlingen', icoon:'<circle cx="12" cy="8" r="3.4"></circle><path d="M5 19.5 c0-3.6 3.1-5.6 7-5.6 s7 2 7 5.6"></path>' },
  { id:'pictos',     naam:"Picto's",    icoon:'<rect x="3" y="6" width="18" height="14" rx="2.4"></rect><circle cx="12" cy="13" r="3.4"></circle><path d="M8 6 l1.5-2.5 h5 L16 6"></path>' },
  { id:'hoeken',     naam:'Hoeken',     icoon:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"></rect>' },
  { id:'uiterlijk',  naam:'Uiterlijk',  icoon:'<circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5 a8.5 8.5 0 0 1 0 17"></path><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"></circle>' },
  { id:'scheiding2', scheiding:true },
  { id:'groep',      naam:'Groep',      icoon:'<circle cx="9" cy="9" r="3.2"></circle><path d="M3.5 19 c0-3 2.5-4.6 5.5-4.6 s5.5 1.6 5.5 4.6"></path><path d="M16 7.2 a3 3 0 0 1 0 5.6"></path>' },
  { id:'functies',   naam:'Functies',   icoon:'<path d="M4 7.5 h9"></path><path d="M17 7.5 h3"></path><circle cx="15" cy="7.5" r="2.2"></circle><path d="M4 16.5 h3"></path><path d="M11 16.5 h9"></path><circle cx="9" cy="16.5" r="2.2"></circle>' }
];

var panelen = {};
var huidig = 'vandaag';

function tekenMenu(){
  var menu = leeg($('zij-menu'));
  ONDERDELEN.forEach(function (o) {
    if (o.scheiding) { menu.appendChild(el('div', 'zij-scheiding')); return; }
    var k = el('button', 'zij-knop' + (o.id === huidig ? ' aan' : ''));
    k.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + o.icoon + '</svg>';
    k.appendChild(el('span', null, o.naam));
    k.addEventListener('click', function () { ga(o.id); });
    menu.appendChild(k);
  });
  $('zij-groep').textContent = KB.klas().naam;
}
function ga(id){
  huidig = id;
  try { location.hash = id; } catch (e) {}
  tekenMenu(); teken();
  var inhoud = $('inhoud'); if (inhoud) inhoud.scrollTop = 0;
}
function teken(){
  var v = leeg($('inhoud'));
  (panelen[huidig] || panelen.vandaag)(v);
}

/* ══════════════════════════════════════════════════════════
   VANDAAG
   ══════════════════════════════════════════════════════════ */
panelen.vandaag = function (v){
  var k = KB.klas(), b = KB.bord(k);
  var dag = KB.dagVanVandaag(), ws = KB.weekSleutel();
  var hoeken = KB.bordHoeken(b, k);

  var naarBord = el('a', 'knop knop-primair knop-klein', 'Bord openen');
  naarBord.href = 'bord.html';
  v.appendChild(kopregel('Vandaag', k.naam + ' · ' + KB.DAGEN_LANG[dag], naarBord));

  // Zolang er geen server is, is een back-up het enige vangnet en zeuren we
  // erom. Staat alles op de server, dan hoeft dat niet meer -- dan is een
  // back-up nog wel handig, maar niet spannend.
  var backupStand = backupTekst();
  if (backupStand.dringend && !opServer()) {
    var waarschuwing = paneel();
    waarschuwing.style.borderLeft = '3px solid var(--let-op)';
    var kop = el('div', 'rij-naam', 'Maak even een back-up');
    waarschuwing.appendChild(kop);
    waarschuwing.appendChild(el('div', 'rij-sub',
      backupStand.tekst + ' Alles staat nog in de browser van dit apparaat.'));
    waarschuwing.appendChild(knop('Nu doen', 'primair', downloadBackup)).style.marginTop = '12px';
    v.appendChild(waarschuwing);
  }

  var rooster = el('div', 'rooster2');

  /* wie is er vandaag aan de beurt in de werkplaats */
  var beurt = paneel('Vandaag in de werkplaats',
    knop('Weekplan openen', 'stil', function () { ga('week'); }));
  var gepland = KB.geplandVandaag(ws, dag, k);
  if (!gepland.length) {
    beurt.appendChild(el('p', 'hint',
      'Er staat vandaag niemand ingepland. Plan een taak in bij Weekplan, ' +
      'dan staan de kinderen die aan de beurt zijn hier klaar.'));
  } else {
    var perTaak = {};
    gepland.forEach(function (g) { (perTaak[g.taakId] = perTaak[g.taakId] || []).push(g.leerlingId); });
    Object.keys(perTaak).forEach(function (taakId) {
      var t = KB.taakVan(taakId, k);
      var kop = el('div');
      kop.style.cssText = 'display:flex;align-items:center;gap:8px;margin:10px 0 8px';
      var stip = el('span', 'stip'); stip.style.background = (t && t.kleur) || '#3b6ff0';
      kop.appendChild(stip);
      kop.appendChild(el('div', 'rij-naam', t ? t.naam : 'Taak'));
      beurt.appendChild(kop);
      var rij = el('div', 'kindrij');
      perTaak[taakId].forEach(function (id) {
        var l = KB.leerling(id, k);
        if (l) rij.appendChild(kindKaart(l, 46));
      });
      beurt.appendChild(rij);
    });
    beurt.appendChild(knop('Zet ze klaar in de werkplaats', 'primair', function () {
      var h = KB.zorgVoorWerkplaats(k);
      var bb = KB.bord(k);
      bb.plaatsingen[h.id] = [];
      gepland.slice(0, h.maxKinderen).forEach(function (g) {
        bb.plaatsingen[h.id].push({ leerlingId: g.leerlingId, startTijd: Date.now(), gereserveerd: true });
      });
      bewaarOfKlaag(); teken();
      meld(Math.min(gepland.length, h.maxKinderen) + ' kinderen klaargezet');
    })).style.marginTop = '14px';
  }
  rooster.appendChild(beurt);

  var rechts = el('div');

  var zit = paneel('Wie zit waar');
  if (!hoeken.length) {
    zit.appendChild(el('p', 'hint', 'Deze groep heeft nog geen hoeken.'));
  } else {
    hoeken.forEach(function (h) {
      var kinderen = KB.bezetting(h.id, b);
      var rij = el('div', 'rij');
      var naam = el('div');
      naam.appendChild(el('div', 'rij-naam', h.naam + (h.werkplaats ? ' · werkplaats' : '')));
      naam.appendChild(el('div', 'rij-sub', kinderen.length + ' van ' + h.maxKinderen));
      rij.appendChild(naam);
      var bollen = el('div');
      bollen.style.cssText = 'display:flex;gap:5px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end';
      kinderen.forEach(function (p) {
        var l = KB.leerling(p.leerlingId, k);
        if (l) { var bol = pictoBol(l, 28); bol.title = l.naam; bollen.appendChild(bol); }
      });
      rij.appendChild(bollen);
      zit.appendChild(rij);
    });
  }
  rechts.appendChild(zit);

  var stand = paneel('Deze week');
  var w = KB.week(ws, k);
  var kinderen = (k.leerlingen || []).filter(function (l) { return l.lid !== false; });
  var aanDeBeurt = {};
  w.taken.forEach(function (wt) { KB.toegewezen(wt).forEach(function (id) { aanDeBeurt[id] = true; }); });
  [['Taken ingepland', String(w.taken.length)],
   ['Kinderen met een beurt', Object.keys(aanDeBeurt).length + ' van ' + kinderen.length],
   ['Doelen centraal deze week', String((w.centraleDoelIds || []).length)],
   ['Doelen aangevinkt voor de groep', String(Object.keys(k.doelActief || {}).length)]
  ].forEach(function (paar) {
    var rij = el('div', 'rij');
    var naam = el('div', 'rij-naam', paar[0]); naam.style.fontWeight = '400';
    rij.appendChild(naam);
    var wrd = el('div', 'rij-naam', paar[1]); wrd.style.marginLeft = 'auto';
    rij.appendChild(wrd);
    stand.appendChild(rij);
  });
  if (Object.keys(aanDeBeurt).length < kinderen.length && w.taken.length) {
    var mist = kinderen.filter(function (l) { return !aanDeBeurt[l.id]; });
    var waarschuwing = el('div', 'signaal');
    waarschuwing.appendChild(el('div', 'signaal-kop', 'Nog niet aan de beurt'));
    waarschuwing.appendChild(el('div', 'hint',
      mist.map(function (l) { return l.naam; }).join(', ')));
    stand.appendChild(waarschuwing);
  }
  rechts.appendChild(stand);

  rooster.appendChild(rechts);
  v.appendChild(rooster);
};

/* ══════════════════════════════════════════════════════════
   GROEP
   ══════════════════════════════════════════════════════════ */
panelen.groep = function (v){
  var k = KB.klas();
  v.appendChild(kopregel('Groep', 'De instellingen van ' + k.naam));

  var instellen = paneel('Deze groep');
  var naamVeld = el('div', 'veld');
  naamVeld.appendChild(el('label', null, 'Naam'));
  var invoer = el('input'); invoer.type = 'text'; invoer.value = k.naam;
  invoer.addEventListener('change', function () {
    k.naam = invoer.value.trim() || k.naam; bewaarOfKlaag(); tekenMenu(); meld('Naam opgeslagen');
  });
  naamVeld.appendChild(invoer);
  instellen.appendChild(naamVeld);

  var niveauVeld = el('div', 'veld');
  niveauVeld.appendChild(el('label', null, 'Beheersingsniveaus voor de doelen'));
  var chips = el('div', 'chips');
  ['0','1a','1b','1','2a','2b','2','3a','3b','3'].forEach(function (n) {
    var aan = KB.klasNiveaus(k).indexOf(n) >= 0;
    var c = el('button', 'chip' + (aan ? ' aan' : ''), n);
    c.addEventListener('click', function () {
      var lijst = KB.klasNiveaus(k).slice();
      var i = lijst.indexOf(n);
      if (i >= 0) lijst.splice(i, 1); else lijst.push(n);
      k.doelNiveaus = lijst; bewaarOfKlaag(); teken();
    });
    chips.appendChild(c);
  });
  niveauVeld.appendChild(chips);
  niveauVeld.appendChild(el('p', 'hint',
    'Groep 1 werkt meestal op 0, 1a, 1b en 1; groep 2 op 2a, 2b en 2. De halfjaarniveaus dragen ' +
    'spel, taal en rekenen, de hele-jaarniveaus motoriek en sociaal-emotioneel.'));
  instellen.appendChild(niveauVeld);
  v.appendChild(instellen);

  var beheer = paneel('Schoolbeheer');
  beheer.appendChild(el('p', 'hint',
    'Deze omgeving hoort bij \u00e9\u00e9n groep. Groepen aanmaken, wisselen of over de hele ' +
    'school kijken gaat via het schoolbeheer.'));
  var link = el('a', 'knop knop-stil knop-klein', 'Schoolbeheer openen');
  link.href = 'school.html'; link.style.marginTop = '12px';
  beheer.appendChild(link);
  v.appendChild(beheer);
};

/* ══════════════════════════════════════════════════════════
   LEERLINGEN
   ══════════════════════════════════════════════════════════ */
panelen.leerlingen = function (v){
  var k = KB.klas();
  v.appendChild(kopregel('Leerlingen', (k.leerlingen || []).length + ' kinderen in ' + k.naam,
    [knop('Kind toevoegen', 'primair', function () { bewerkLeerling(null); }),
     knop('Lijst plakken', 'stil', plakLijst),
     bestandKnop('Word-bestand inlezen', '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 false, leesWordBestand)]));

  var p = paneel();
  if (!(k.leerlingen || []).length) {
    p.appendChild(leegBericht(
      'Nog geen kinderen in deze groep. Voeg ze los toe, plak een lijst met namen, ' +
      'of lees een Word-bestand in waarin namen en picto\'s bij elkaar staan.'));
  } else {
    var rooster = el('div', 'leerlingrooster');
    k.leerlingen.forEach(function (l) {
      rooster.appendChild(kindKaart(l, 54, function () { bewerkLeerling(l); }));
    });
    p.appendChild(rooster);
  }
  v.appendChild(p);
};

function plakLijst(){
  var k = KB.klas();
  toonBlad(function (blad) {
    blad.appendChild(bladTitel('Lijst met namen plakken', 'Eén naam per regel.'));
    var vak = el('textarea');
    vak.className = 'tekstvak';
    vak.placeholder = 'Benjamin\nMia\nHugo';
    blad.appendChild(vak);
    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Toevoegen', 'primair', function () {
      var namen = vak.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!namen.length) { meld('Geen namen gevonden'); return; }
      namen.forEach(function (n, i) {
        k.leerlingen.push({ id:'ll' + KB.uid(), naam:n,
          kleur: KB.KIND_KLEUREN[(k.leerlingen.length + i) % KB.KIND_KLEUREN.length],
          image:null, lid:true });
      });
      bewaarOfKlaag(); sluitBlad(); teken(); meld(namen.length + ' kinderen toegevoegd');
    }));
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    blad.appendChild(rij);
    setTimeout(function () { vak.focus(); }, 60);
  });
}

/* ── Word-bestand: namen en picto's in één keer ──────────── */
function leesWordBestand(file){
  meld('Bezig met lezen…');
  KBDocx.lees(file).then(function (uit) {
    if (!uit.paren.length) {
      meld('Geen picto\'s gevonden in dit bestand');
      return;
    }
    return Promise.all(uit.paren.map(function (p) {
      return KB.verklein(p.blob, KB.FOTO_MAAT.leerling)
        .then(function (data) { return { naam: p.naam, data: data }; })
        .catch(function () { return null; });
    })).then(function (lijst) {
      toonWordBevestiging(lijst.filter(Boolean));
    });
  }).catch(function (e) {
    meld('Lukte niet: ' + (e.message || 'onbekend bestand'));
  });
}

function netteNaam(t){
  // "hugo l." wordt "Hugo L." — jullie bestanden staan in kleine letters.
  return (t || '').toLowerCase().replace(/(^|[\s\-\'])([a-zà-ÿ])/g, function (heel, voor, letter) {
    return voor + letter.toUpperCase();
  }).trim();
}

function toonWordBevestiging(lijst){
  var k = KB.klas();
  lijst.forEach(function (item) { item.naam = netteNaam(item.naam); item.mee = !!item.naam; });
  var doelGroep = 'huidig';   // 'huidig' of 'nieuw'
  var nieuweNaam = 'Groep 1D';

  toonBlad(function (blad) {
    var metNaam = lijst.filter(function (x) { return x.naam; }).length;
    var zonder  = lijst.length - metNaam;

    blad.appendChild(bladTitel(lijst.length + " picto's gevonden",
      metNaam + ' hebben een naam' + (zonder ? ', ' + zonder + ' niet — die staan uitgevinkt. ' +
      'Typ er een naam bij als je ze toch wilt gebruiken.' : '.') +
      ' Word legt niet vast welke naam bij welk plaatje hoort, dus controleer het even.'));

    /* waar gaan ze heen */
    var keuze = el('div', 'veld');
    keuze.appendChild(el('label', null, 'Waar komen deze kinderen?'));
    var opties = el('div', 'chips');
    var chipHuidig = el('button', 'chip aan', 'In ' + k.naam);
    var chipNieuw  = el('button', 'chip', 'In een nieuwe groep');
    opties.appendChild(chipHuidig); opties.appendChild(chipNieuw);
    keuze.appendChild(opties);
    var naamVak = el('div');
    naamVak.style.display = 'none';
    naamVak.style.marginTop = '10px';
    var naamInvoer = el('input');
    naamInvoer.type = 'text'; naamInvoer.value = nieuweNaam; naamInvoer.placeholder = 'Naam van de groep';
    naamInvoer.addEventListener('input', function () { nieuweNaam = naamInvoer.value; });
    naamVak.appendChild(naamInvoer);
    keuze.appendChild(naamVak);
    chipHuidig.addEventListener('click', function () {
      doelGroep = 'huidig';
      chipHuidig.classList.add('aan'); chipNieuw.classList.remove('aan');
      naamVak.style.display = 'none';
    });
    chipNieuw.addEventListener('click', function () {
      doelGroep = 'nieuw';
      chipNieuw.classList.add('aan'); chipHuidig.classList.remove('aan');
      naamVak.style.display = '';
    });
    blad.appendChild(keuze);

    /* selectieknoppen */
    var selectie = el('div', 'knoprij');
    selectie.style.marginTop = '4px';
    var telling = el('span', 'hint');
    telling.style.alignSelf = 'center';
    function werkTellingBij(){
      var n = lijst.filter(function (x) { return x.mee && x.naam; }).length;
      telling.textContent = n + ' van de ' + lijst.length + ' geselecteerd';
    }
    selectie.appendChild(knop('Alles aan', 'stil', function () {
      lijst.forEach(function (x) { if (x.naam) x.mee = true; });
      tekenRooster(); werkTellingBij();
    }));
    selectie.appendChild(knop('Alles uit', 'stil', function () {
      lijst.forEach(function (x) { x.mee = false; });
      tekenRooster(); werkTellingBij();
    }));
    selectie.appendChild(telling);
    blad.appendChild(selectie);

    var rooster = el('div', 'wordrooster');
    blad.appendChild(rooster);

    function tekenRooster(){
      leeg(rooster);
      lijst.forEach(function (item, i) {
        var vak = el('label', 'wordvak' + (item.mee ? ' mee' : ''));
        var vink = el('input');
        vink.type = 'checkbox'; vink.checked = item.mee; vink.className = 'wordvink';
        vink.addEventListener('change', function () {
          lijst[i].mee = vink.checked;
          vak.classList.toggle('mee', vink.checked);
          werkTellingBij();
        });
        vak.appendChild(vink);
        var bol = el('div', 'picto-rond');
        bol.style.cssText = 'width:64px;height:64px;background-image:url(' + item.data + ')';
        vak.appendChild(bol);
        var invoer = el('input');
        invoer.type = 'text'; invoer.value = item.naam || '';
        invoer.placeholder = 'geen naam';
        invoer.addEventListener('click', function (e) { e.preventDefault(); });
        invoer.addEventListener('input', function () {
          lijst[i].naam = invoer.value;
          if (invoer.value && !lijst[i].mee) { lijst[i].mee = true; vink.checked = true; vak.classList.add('mee'); }
          werkTellingBij();
        });
        vak.appendChild(invoer);
        rooster.appendChild(vak);
      });
    }
    tekenRooster(); werkTellingBij();

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Overnemen', 'primair', function () {
      var mee = lijst.filter(function (x) { return x.mee && (x.naam || '').trim(); });
      if (!mee.length) { meld('Niets geselecteerd'); return; }

      var groep = k;
      if (doelGroep === 'nieuw') {
        groep = KB.leegKlas((nieuweNaam || 'Nieuwe groep').trim());
        var code = (groep.naam.match(/\b([123])\b/) || [])[1];
        groep.doelNiveaus = KB.NIVEAUS_PER_GROEP[code || 1] || KB.NIVEAUS_PER_GROEP[1];
        groep.hoekLib = [['Bouwhoek',4],['Huishoek',3],['Zandtafel',4],['Knutselhoek',4],['Leeshoek',3]]
          .map(function (h, i) {
            return { id:'hl' + KB.uid() + i, naam:h[0], maxKinderen:h[1], timerMinuten:0, fotoId:null };
          });
        var bord = groep.borden[0];
        bord.hoekLibIds = groep.hoekLib.map(function (h) { return h.id; });
        groep.hoekLib.forEach(function (h) { bord.plaatsingen[h.id] = []; });
        KB.G.klassen.push(groep);
        KB.zorgVoorWerkplaats(groep);
      }

      var gekoppeld = 0, nieuwAantal = 0;
      mee.forEach(function (item) {
        var naam = item.naam.trim();
        var bestaand = groep.leerlingen.filter(function (l) {
          return l.naam.trim().toLowerCase() === naam.toLowerCase();
        })[0];
        if (bestaand) { bestaand.image = item.data; bestaand._c = false; gekoppeld++; }
        else {
          groep.leerlingen.push({ id:'ll' + KB.uid(), naam:naam,
            kleur: KB.KIND_KLEUREN[groep.leerlingen.length % KB.KIND_KLEUREN.length],
            image:item.data, lid:true });
          nieuwAantal++;
        }
        KB.voegPictoToe(naam, item.data, groep);
      });

      if (doelGroep === 'nieuw') {
        KB.zetBeheerKlas(groep.id);
        bewaarOfKlaag(); sluitBlad(); tekenMenu(); teken();
        meld(groep.naam + ' aangemaakt met ' + nieuwAantal + ' kinderen');
      } else {
        bewaarOfKlaag(); sluitBlad(); teken();
        meld(nieuwAantal + ' toegevoegd, ' + gekoppeld + ' gekoppeld');
      }
    }));
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    blad.appendChild(rij);
  }, true);
}

function bewerkLeerling(l){
  var k = KB.klas(), nieuw = !l;
  var concept = { naam: l ? l.naam : '', kleur: l ? l.kleur : KB.KIND_KLEUREN[0],
                  image: l ? l.image : null };

  toonBlad(function (blad) {
    blad.appendChild(bladTitel(nieuw ? 'Kind toevoegen' : l.naam));

    var boven = el('div');
    boven.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:18px;flex-wrap:wrap';
    var bol = pictoBol(concept, 64);
    boven.appendChild(bol);
    boven.appendChild(bestandKnop('Foto kiezen', 'image/*', false, function (f) {
      KB.verklein(f, KB.FOTO_MAAT.leerling).then(function (d) {
        concept.image = d;
        bol.style.backgroundImage = 'url(' + d + ')'; bol.textContent = '';
        meld('Foto klaar · ' + Math.round(d.length * 0.75 / 1024) + ' KB');
      }).catch(function () { meld('Die foto lukte niet'); });
    }));
    boven.appendChild(knop("Uit picto's kiezen", 'stil', function () {
      // Het formulier wordt opnieuw getekend zodra de kiezer sluit, dus
      // hoeven we hier alleen het concept bij te werken.
      kiesPicto(function (p) { concept.image = p.data; });
    }));
    blad.appendChild(boven);

    var naamVeld = el('div', 'veld');
    naamVeld.appendChild(el('label', null, 'Naam'));
    var invoer = el('input'); invoer.type = 'text'; invoer.value = concept.naam;
    invoer.addEventListener('input', function () {
      concept.naam = invoer.value;
      if (!concept.image) bol.textContent = (invoer.value || '?').charAt(0).toUpperCase();
    });
    naamVeld.appendChild(invoer);
    blad.appendChild(naamVeld);

    var kleurVeld = el('div', 'veld');
    kleurVeld.appendChild(el('label', null, 'Kleur'));
    var kleuren = el('div', 'chips');
    KB.KIND_KLEUREN.forEach(function (c) {
      var stip = el('button', 'kleurstip');
      stip.style.background = c;
      stip.classList.toggle('aan', c === concept.kleur);
      stip.addEventListener('click', function () {
        concept.kleur = c;
        bol.style.background = c;
        if (concept.image) bol.style.backgroundImage = 'url(' + concept.image + ')';
        Array.prototype.forEach.call(kleuren.children, function (s, i) {
          s.classList.toggle('aan', KB.KIND_KLEUREN[i] === c);
        });
      });
      kleuren.appendChild(stip);
    });
    kleurVeld.appendChild(kleuren);
    blad.appendChild(kleurVeld);

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Opslaan', 'primair', function () {
      var naam = (concept.naam || '').trim();
      if (!naam) { meld('Vul een naam in'); return; }
      if (nieuw) {
        k.leerlingen.push({ id:'ll' + KB.uid(), naam:naam, kleur:concept.kleur,
                            image:concept.image, lid:true });
      } else {
        l.naam = naam; l.kleur = concept.kleur;
        if (concept.image !== l.image) { l.image = concept.image; l._c = false; }
      }
      bewaarOfKlaag(); sluitBlad(); teken(); meld('Opgeslagen');
    }));
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    if (!nieuw) rij.appendChild(knop('Verwijderen', 'gevaar', function () {
      sluitBlad();
      vraagBevestiging('Kind verwijderen?', l.naam + ' verdwijnt uit deze groep.', 'Verwijderen', function () {
        k.leerlingen = k.leerlingen.filter(function (x) { return x.id !== l.id; });
        bewaarOfKlaag(); teken(); meld('Verwijderd');
      });
    }));
    blad.appendChild(rij);
    setTimeout(function () { invoer.focus(); }, 60);
  });
}

/* ══════════════════════════════════════════════════════════
   PICTO'S
   ══════════════════════════════════════════════════════════ */
panelen.pictos = function (v){
  var k = KB.klas();
  var lijst = KB.pictos(k);
  v.appendChild(kopregel("Picto's", lijst.length + ' losse picto\'s in ' + k.naam,
    [bestandKnop("Picto's toevoegen", 'image/*', true, function (bestanden) {
       voegPictosToe(bestanden);
     }, 'primair'),
     bestandKnop('Uit Word-bestand', '.docx', false, leesWordBestand)]));

  var p = paneel();
  p.appendChild(el('p', 'hint',
    'Losse picto\'s die je later aan een kind koppelt. Handig als je eerst alle plaatjes ' +
    'binnenhaalt en pas daarna kijkt wie erbij hoort.'));
  if (!lijst.length) {
    p.appendChild(leegBericht('Nog geen losse picto\'s.'));
  } else {
    var rooster = el('div', 'leerlingrooster');
    rooster.style.marginTop = '14px';
    lijst.forEach(function (picto) {
      var kaart = el('button', 'leerlingkaart');
      var bol = el('div', 'picto-rond');
      bol.style.cssText = 'width:54px;height:54px;background-image:url(' + picto.data + ')';
      kaart.appendChild(bol);
      kaart.appendChild(el('div', 'picto-naam', picto.naam));
      kaart.addEventListener('click', function () { bewerkPicto(picto); });
      rooster.appendChild(kaart);
    });
    p.appendChild(rooster);
  }
  v.appendChild(p);
};

function voegPictosToe(bestanden){
  var k = KB.klas(), klaar = 0, gelukt = 0;
  meld('Bezig met ' + bestanden.length + ' afbeeldingen…');
  bestanden.forEach(function (f) {
    KB.verklein(f, KB.FOTO_MAAT.leerling).then(function (data) {
      KB.voegPictoToe(f.name.replace(/\.[^.]+$/, '').slice(0, 30), data, k);
      gelukt++;
    }).catch(function () {}).then(function () {
      klaar++;
      if (klaar === bestanden.length) {
        bewaarOfKlaag(); teken(); meld(gelukt + " picto's toegevoegd");
      }
    });
  });
}

function bewerkPicto(picto){
  var k = KB.klas();
  toonBlad(function (blad) {
    blad.appendChild(bladTitel(picto.naam));
    var bol = el('div', 'picto-rond');
    bol.style.cssText = 'width:96px;height:96px;margin-bottom:16px;background-image:url(' + picto.data + ')';
    blad.appendChild(bol);

    var naamVeld = el('div', 'veld');
    naamVeld.appendChild(el('label', null, 'Naam van het picto'));
    var invoer = el('input'); invoer.type = 'text'; invoer.value = picto.naam;
    naamVeld.appendChild(invoer);
    blad.appendChild(naamVeld);

    var kiesVeld = el('div', 'veld');
    kiesVeld.appendChild(el('label', null, 'Koppelen aan een kind'));
    var kies = el('select');
    kies.appendChild(el('option', null, '— kies een kind —')).value = '';
    (k.leerlingen || []).forEach(function (l) {
      var o = el('option', null, l.naam); o.value = l.id; kies.appendChild(o);
    });
    kiesVeld.appendChild(kies);
    blad.appendChild(kiesVeld);

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Opslaan', 'primair', function () {
      picto.naam = invoer.value.trim() || picto.naam;
      if (kies.value) {
        KB.koppelPicto(kies.value, picto.id, k);
        meld('Gekoppeld aan ' + KB.leerling(kies.value, k).naam);
      } else meld('Opgeslagen');
      bewaarOfKlaag(); sluitBlad(); teken();
    }));
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Verwijderen', 'gevaar', function () {
      k.pictos = KB.pictos(k).filter(function (p) { return p.id !== picto.id; });
      bewaarOfKlaag(); sluitBlad(); teken(); meld('Picto verwijderd');
    }));
    blad.appendChild(rij);
  });
}

function kiesPicto(bijKeuze){
  var k = KB.klas(), lijst = KB.pictos(k);
  toonBlad(function (blad) {
    blad.appendChild(bladTitel("Picto kiezen", lijst.length + " beschikbaar"));
    if (!lijst.length) {
      blad.appendChild(el('p', 'hint',
        'Er zijn nog geen losse picto\'s. Voeg ze toe bij Picto\'s, of lees een Word-bestand in.'));
    } else {
      var rooster = el('div', 'leerlingrooster');
      lijst.forEach(function (p) {
        var kaart = el('button', 'leerlingkaart');
        var bol = el('div', 'picto-rond');
        bol.style.cssText = 'width:54px;height:54px;background-image:url(' + p.data + ')';
        kaart.appendChild(bol);
        kaart.appendChild(el('div', 'picto-naam', p.naam));
        kaart.addEventListener('click', function () { bijKeuze(p); sluitBlad(); });
        rooster.appendChild(kaart);
      });
      blad.appendChild(rooster);
    }
    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Sluiten', 'stil', sluitBlad));
    blad.appendChild(rij);
  }, true);
}

/* ══════════════════════════════════════════════════════════
   HOEKEN
   ══════════════════════════════════════════════════════════ */
panelen.hoeken = function (v){
  var k = KB.klas(), b = KB.bord(k);
  v.appendChild(kopregel('Hoeken', 'De plekken waaruit kinderen kiezen',
    [knop('Hoek toevoegen', 'primair', function () { bewerkHoek(null); }),
     KB.werkplaatsHoek(k) ? null : knop('Werkplaats aanmaken', 'stil', function () {
       KB.zorgVoorWerkplaats(k); bewaarOfKlaag(); teken(); meld('Werkplaats toegevoegd');
     })].filter(Boolean)));

  var p = paneel();
  if (!(k.hoekLib || []).length) {
    p.appendChild(leegBericht('Nog geen hoeken in deze groep.'));
  } else {
    k.hoekLib.forEach(function (h) {
      var opBord = (b.hoekLibIds || []).indexOf(h.id) >= 0;
      var rij = el('div', 'rij');
      var kleurstip = el('span', 'stip');
      kleurstip.style.background = KB.hoekKleur(h, k.hoekLib.indexOf(h));
      rij.appendChild(kleurstip);
      var naam = el('div');
      var titel = el('div', 'rij-naam', h.naam);
      if (h.werkplaats) {
        var merk = el('span', 'merkje', 'werkplaats');
        titel.appendChild(merk);
      }
      naam.appendChild(titel);
      naam.appendChild(el('div', 'rij-sub', h.maxKinderen + ' plekken · ' +
        (h.timerMinuten ? h.timerMinuten + ' minuten' : 'tijd van de groep')));
      rij.appendChild(naam);
      var acties = el('div', 'rij-acties');
      var s = schakelaar(opBord, function (aan) {
        if (aan) {
          if ((b.hoekLibIds || []).indexOf(h.id) < 0) b.hoekLibIds.push(h.id);
          if (!b.plaatsingen[h.id]) b.plaatsingen[h.id] = [];
        } else {
          b.hoekLibIds = b.hoekLibIds.filter(function (id) { return id !== h.id; });
        }
        bewaarOfKlaag();
      });
      s.title = 'Op het bord tonen';
      acties.appendChild(s);
      acties.appendChild(knop('Bewerk', 'stil', function () { bewerkHoek(h); }));
      rij.appendChild(acties);
      p.appendChild(rij);
    });
  }
  v.appendChild(p);
};

function bewerkHoek(h){
  var k = KB.klas(), b = KB.bord(k), nieuw = !h;
  var plaats = k.hoekLib.indexOf(h);
  var concept = { naam: h ? h.naam : '', max: h ? h.maxKinderen : 4,
                  timer: h ? (h.timerMinuten || 0) : 0, fotoId: h ? h.fotoId : null,
                  werkplaats: h ? !!h.werkplaats : false, nieuweFoto: null,
                  kleur: (h && h.kleur) ||
                         KB.HOEKKLEUREN[(plaats >= 0 ? plaats : k.hoekLib.length) % KB.HOEKKLEUREN.length] };

  toonBlad(function (blad) {
    blad.appendChild(bladTitel(nieuw ? 'Hoek toevoegen' : h.naam));

    var naamVeld = el('div', 'veld');
    naamVeld.appendChild(el('label', null, 'Naam'));
    var invoer = el('input'); invoer.type = 'text'; invoer.value = concept.naam;
    invoer.addEventListener('input', function () { concept.naam = invoer.value; ververfKaartje(); });
    naamVeld.appendChild(invoer);
    blad.appendChild(naamVeld);

    var maxVeld = el('div', 'veld');
    maxVeld.appendChild(el('label', null, 'Aantal plekken'));
    maxVeld.appendChild(teller(concept.max, 1, 12, function (n) { concept.max = n; ververfKaartje(); }));
    blad.appendChild(maxVeld);

    var timerVeld = el('div', 'veld');
    timerVeld.appendChild(el('label', null, 'Eigen speelduur in minuten'));
    timerVeld.appendChild(teller(concept.timer, 0, 60, function (n) { concept.timer = n; }));
    timerVeld.appendChild(el('p', 'hint',
      'Op 0 gebruikt deze hoek de tijd van de groep (' + KB.instelling('timerMinuten', k) + ' minuten).'));
    blad.appendChild(timerVeld);

    var wpVeld = el('div', 'rij');
    var wpTekst = el('div');
    wpTekst.style.flexGrow = '1';
    wpTekst.appendChild(el('div', 'rij-naam', 'Dit is de werkplaats'));
    wpTekst.appendChild(el('div', 'rij-sub',
      'De hoek waar kinderen aan hun taak van de week werken. Het weekplan zet hier ' +
      'de kinderen klaar die aan de beurt zijn.'));
    wpVeld.appendChild(wpTekst);
    wpVeld.appendChild(schakelaar(concept.werkplaats, function (aan) { concept.werkplaats = aan; }));
    blad.appendChild(wpVeld);

    var kleurVeld = el('div', 'veld');
    kleurVeld.style.marginTop = '14px';
    kleurVeld.appendChild(el('label', null, 'Kleur van deze hoek'));
    var kaartje = el('div', 'hoekvoorbeeld');
    var kaartBeeld = el('div', 'hoekvoorbeeld-beeld');
    var kaartOnder = el('div', 'hoekvoorbeeld-onder');
    var kaartNaam = el('div', 'hoekvoorbeeld-naam');
    var kaartPlekken = el('div', 'hoekvoorbeeld-plekken');
    kaartOnder.appendChild(kaartNaam); kaartOnder.appendChild(kaartPlekken);
    kaartje.appendChild(kaartBeeld); kaartje.appendChild(kaartOnder);
    kleurVeld.appendChild(kaartje);

    function ververfKaartje(){
      var t = KB.hoekTinten({ kleur: concept.kleur }, 0);
      kaartje.style.background = t.zacht;
      kaartje.style.boxShadow = '0 1px 2px rgba(20,28,44,.05), 0 6px 18px ' + t.schaduw;
      kaartBeeld.style.background = t.tint;
      var beeldData = concept.nieuweFoto || KB.foto(concept.fotoId, k);
      kaartBeeld.style.backgroundImage = beeldData ? 'url(' + beeldData + ')' : '';
      kaartBeeld.innerHTML = beeldData ? '' :
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' + t.kleur +
        '" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="13" width="8" height="8" rx="1.5">' +
        '</rect><rect x="13" y="13" width="8" height="8" rx="1.5"></rect>' +
        '<rect x="8" y="4" width="8" height="8" rx="1.5"></rect></svg>';
      kaartNaam.textContent = concept.naam || 'Naam van de hoek';
      kaartNaam.style.color = t.tekst;
      leeg(kaartPlekken);
      for (var i = 0; i < concept.max; i++) {
        var stip2 = el('div', 'hoekvoorbeeld-plek');
        stip2.style.borderColor = t.kleur;
        kaartPlekken.appendChild(stip2);
      }
    }

    var kleuren = el('div', 'chips');
    kleuren.style.marginTop = '12px';
    KB.HOEKKLEUREN.forEach(function (c) {
      var stipje = el('button', 'kleurstip');
      stipje.style.background = c; stipje.style.color = c;
      stipje.classList.toggle('aan', c === concept.kleur);
      stipje.addEventListener('click', function () {
        concept.kleur = c;
        Array.prototype.forEach.call(kleuren.children, function (x, i) {
          if (KB.HOEKKLEUREN[i]) x.classList.toggle('aan', KB.HOEKKLEUREN[i] === concept.kleur);
        });
        eigenKleur.value = c;
        ververfKaartje();
      });
      kleuren.appendChild(stipje);
    });
    var eigenKleur = el('input');
    eigenKleur.type = 'color'; eigenKleur.className = 'kleurkiezer';
    eigenKleur.value = concept.kleur; eigenKleur.title = 'Zelf een kleur kiezen';
    eigenKleur.addEventListener('input', function () {
      concept.kleur = eigenKleur.value;
      Array.prototype.forEach.call(kleuren.children, function (x) { x.classList.remove('aan'); });
      ververfKaartje();
    });
    kleuren.appendChild(eigenKleur);
    kleurVeld.appendChild(kleuren);
    blad.appendChild(kleurVeld);

    var fotoVeld = el('div', 'veld');
    fotoVeld.style.marginTop = '14px';
    fotoVeld.appendChild(el('label', null, 'Foto'));
    var voorbeeld = el('div', 'fotovoorbeeld');
    var bestaande = KB.foto(concept.fotoId, k);
    if (bestaande) voorbeeld.style.backgroundImage = 'url(' + bestaande + ')';
    fotoVeld.appendChild(voorbeeld);
    fotoVeld.appendChild(bestandKnop('Foto kiezen', 'image/*', false, function (f) {
      KB.verklein(f, KB.FOTO_MAAT.hoek).then(function (d) {
        concept.nieuweFoto = d;
        voorbeeld.style.backgroundImage = 'url(' + d + ')';
        ververfKaartje();
        meld('Foto klaar · ' + Math.round(d.length * 0.75 / 1024) + ' KB');
      }).catch(function () { meld('Die foto lukte niet'); });
    }));
    blad.appendChild(fotoVeld);

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Opslaan', 'primair', function () {
      var naam = (concept.naam || '').trim();
      if (!naam) { meld('Vul een naam in'); return; }
      var fotoId = concept.fotoId;
      if (concept.nieuweFoto) {
        fotoId = 'f' + KB.uid();
        k.fotoLib.push({ id:fotoId, naam:naam, data:concept.nieuweFoto, categorie:'hoekfoto' });
      }
      if (concept.werkplaats) {
        k.hoekLib.forEach(function (x) { if (!h || x.id !== h.id) x.werkplaats = false; });
      }
      if (nieuw) {
        var id = 'hl' + KB.uid();
        k.hoekLib.push({ id:id, naam:naam, maxKinderen:concept.max,
                         timerMinuten:concept.timer || 0, fotoId:fotoId,
                         kleur:concept.kleur, werkplaats:concept.werkplaats });
        b.hoekLibIds.push(id); b.plaatsingen[id] = [];
      } else {
        h.naam = naam; h.maxKinderen = concept.max; h.timerMinuten = concept.timer || 0;
        h.fotoId = fotoId; h.kleur = concept.kleur; h.werkplaats = concept.werkplaats;
      }
      bewaarOfKlaag(); sluitBlad(); teken(); meld('Opgeslagen');
    }));
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    if (!nieuw) rij.appendChild(knop('Verwijderen', 'gevaar', function () {
      sluitBlad();
      vraagBevestiging('Hoek verwijderen?', h.naam + ' verdwijnt uit deze groep.', 'Verwijderen', function () {
        k.hoekLib = k.hoekLib.filter(function (x) { return x.id !== h.id; });
        b.hoekLibIds = b.hoekLibIds.filter(function (id) { return id !== h.id; });
        delete b.plaatsingen[h.id];
        bewaarOfKlaag(); teken(); meld('Verwijderd');
      });
    }));
    blad.appendChild(rij);
    ververfKaartje();
  });
}


/* ══════════════════════════════════════════════════════════
   UITERLIJK VAN HET BORD
   ══════════════════════════════════════════════════════════ */
panelen.uiterlijk = function (v){
  var k = KB.klas();
  var u = KB.uiterlijk(k);

  var naarBord = el('a', 'knop knop-stil knop-klein', 'Bekijk op het bord');
  naarBord.href = 'bord.html';
  v.appendChild(kopregel('Uiterlijk', 'Hoe het bord van ' + k.naam + ' eruitziet', naarBord));

  /* levende voorvertoning */
  var voorbeeld = el('div', 'bordvoorbeeld');
  function ververs(){
    voorbeeld.style.background = KB.achtergrondCss(k);
  }
  ['Bouwhoek', 'Huishoek', 'Zandtafel'].forEach(function (naam, i) {
    var tinten = [['#dfe9fd','#3b6ff0','#f2f6ff'], ['#fde0e8','#e2607f','#fff3f6'],
                  ['#fdeecd','#e79a1f','#fff9ed']][i];
    var kaartje = el('div', 'voorbeeldkaart');
    kaartje.style.background = tinten[2];
    var beeld = el('div', 'voorbeeldbeeld');
    beeld.style.background = tinten[0];
    kaartje.appendChild(beeld);
    var naamvak = el('div', 'voorbeeldnaam', naam);
    naamvak.style.color = tinten[1];
    kaartje.appendChild(naamvak);
    voorbeeld.appendChild(kaartje);
  });
  ververs();
  v.appendChild(voorbeeld);

  /* sfeer kiezen */
  var sfeerP = paneel('Sfeer');
  var rooster = el('div', 'sfeerrooster');
  KB.SFEREN.forEach(function (sf) {
    var knopje = el('button', 'sfeerknop' + (u.soort === 'sfeer' && u.sfeer === sf.id ? ' aan' : ''));
    var vlak = el('div', 'sfeervlak');
    var lagen = sf.vlekken.map(function (vl) {
      return 'radial-gradient(60px 40px at ' + vl[1] + ', ' + vl[0] + ' 0%, transparent 62%)';
    });
    lagen.push(sf.grond);
    vlak.style.background = lagen.join(', ');
    knopje.appendChild(vlak);
    knopje.appendChild(el('span', null, sf.naam));
    knopje.addEventListener('click', function () {
      u.soort = 'sfeer'; u.sfeer = sf.id;
      bewaarOfKlaag(); teken();
    });
    rooster.appendChild(knopje);
  });
  sfeerP.appendChild(rooster);
  v.appendChild(sfeerP);

  /* eigen kleur */
  var kleurP = paneel('Eigen kleur');
  kleurP.appendChild(el('p', 'hint', 'Liever één rustige kleur? Kies er hier een.'));
  var kleurRij = el('div', 'kleurrij');
  ['#fbf8f4','#f5f8fb','#f7f7f8','#eef4ec','#fdf4ee','#f1f0f7','#eaf1f5','#fdf2f4']
    .forEach(function (c) {
      var stip = el('button', 'kleurstip' + (u.soort === 'kleur' && u.kleur === c ? ' aan' : ''));
      stip.style.background = c;
      stip.style.boxShadow = 'inset 0 0 0 1px rgba(20,28,44,.08)' +
        (u.soort === 'kleur' && u.kleur === c ? ', 0 0 0 3px var(--vlak), 0 0 0 5px var(--accent)' : '');
      stip.addEventListener('click', function () {
        u.soort = 'kleur'; u.kleur = c; bewaarOfKlaag(); teken();
      });
      kleurRij.appendChild(stip);
    });
  var eigen = el('input');
  eigen.type = 'color';
  eigen.value = u.kleur || '#fbf8f4';
  eigen.className = 'kleurkiezer';
  eigen.title = 'Zelf een kleur kiezen';
  eigen.addEventListener('input', function () {
    u.soort = 'kleur'; u.kleur = eigen.value;
    voorbeeld.style.background = KB.achtergrondCss(k);
  });
  eigen.addEventListener('change', function () { bewaarOfKlaag(); teken(); });
  kleurRij.appendChild(eigen);
  kleurP.appendChild(kleurRij);
  v.appendChild(kleurP);

  /* achtergrondfoto */
  var fotoP = paneel('Eigen achtergrond');
  fotoP.appendChild(el('p', 'hint',
    'Kies een foto — bijvoorbeeld van het thema waar je mee bezig bent. Hij wordt ' +
    'automatisch op maat gemaakt voor het digibord, dus hij hoeft niet precies te passen. ' +
    'Met de schuif eroverheen maak je de foto zachter, zodat de picto\'s leesbaar blijven.'));

  if (u.foto) {
    var huidig = el('div', 'fotovoorbeeld');
    huidig.style.backgroundImage = 'url(' + u.foto + ')';
    huidig.style.height = '120px';
    huidig.style.marginTop = '12px';
    fotoP.appendChild(huidig);

    var schuifVeld = el('div', 'veld');
    schuifVeld.style.marginTop = '14px';
    schuifVeld.appendChild(el('label', null, 'Hoe zacht mag de foto worden?'));
    var schuif = el('input');
    schuif.type = 'range'; schuif.min = '0'; schuif.max = '85'; schuif.step = '5';
    schuif.value = String(Math.round((u.sluier == null ? 0.4 : u.sluier) * 100));
    schuif.className = 'schuif';
    var uitleg = el('div', 'hint');
    function toonSchuif(){
      var w = parseInt(schuif.value, 10);
      uitleg.textContent = w < 20 ? 'Foto goed zichtbaar — let op of de namen leesbaar blijven.'
        : w < 55 ? 'Mooie balans tussen foto en leesbaarheid.'
        : 'Heel zacht — rustig, de foto is nog net te zien.';
    }
    schuif.addEventListener('input', function () {
      u.sluier = parseInt(schuif.value, 10) / 100;
      voorbeeld.style.background = KB.achtergrondCss(k);
      toonSchuif();
    });
    schuif.addEventListener('change', function () { bewaarOfKlaag(); });
    schuifVeld.appendChild(schuif);
    schuifVeld.appendChild(uitleg);
    toonSchuif();
    fotoP.appendChild(schuifVeld);
  }

  var fotoRij = el('div', 'knoprij');
  fotoRij.appendChild(bestandKnop(u.foto ? 'Andere foto kiezen' : 'Foto kiezen', 'image/*', false,
    function (f) {
      meld('Bezig met de foto…');
      KB.achtergrondUitBestand(f).then(function (data) {
        u.soort = 'foto'; u.foto = data;
        if (u.sluier == null) u.sluier = 0.4;
        bewaarOfKlaag(); teken();
        meld('Achtergrond ingesteld · ' + Math.round(data.length * 0.75 / 1024) + ' KB');
      }).catch(function (e) { meld('Lukte niet: ' + (e.message || 'onbekend')); });
    }, u.foto ? 'stil' : 'primair'));
  if (u.foto) {
    fotoRij.appendChild(knop(u.soort === 'foto' ? 'Foto uitzetten' : 'Foto gebruiken', 'stil', function () {
      u.soort = u.soort === 'foto' ? 'sfeer' : 'foto';
      bewaarOfKlaag(); teken();
    }));
    fotoRij.appendChild(knop('Foto verwijderen', 'gevaar', function () {
      u.foto = null; u.soort = 'sfeer'; bewaarOfKlaag(); teken(); meld('Achtergrond verwijderd');
    }));
  }
  fotoP.appendChild(fotoRij);
  v.appendChild(fotoP);
};

/* ══════════════════════════════════════════════════════════
   FUNCTIES
   ══════════════════════════════════════════════════════════ */
var FUNCTIES_BORD = [
  ['timerAan',    'Tijdvergrendeling', 'Een kind blijft even in de gekozen hoek. De ring op het picto loopt vol.'],
  ['wachtrijAan', 'Wachtrij bij volle hoek', 'Kinderen melden zich aan en schuiven door zodra er plek is.'],
  ['tellingAan',  'Telling op het picto', 'Laat zien hoe vaak een kind deze week in die hoek was.'],
  ['werkplaatsAan','Werkplaats klaarzetten', 'Zet de kinderen die aan de beurt zijn alvast in de werkplaats.']
];
var FUNCTIES_BEHEER = [
  ['pinAan',        'PIN op het beheer', 'Vraagt een code voordat je bij de instellingen komt.'],
  ['signaleringAan','Signalering', 'Waarschuwt als een kind aan het eind van de week nog niet aan de beurt is geweest.']
];

panelen.functies = function (v){
  var k = KB.klas();
  if (!k.settings) k.settings = KB.standaardInstellingen();
  v.appendChild(kopregel('Functies', 'Geldt alleen voor ' + k.naam));

  var snel = paneel();
  var kop = el('div');
  kop.style.cssText = 'display:flex;align-items:center;gap:16px;flex-wrap:wrap';
  var tekst = el('div');
  tekst.style.flexGrow = '1';
  tekst.appendChild(el('div', 'rij-naam', 'Snel instellen'));
  tekst.appendChild(el('div', 'rij-sub', 'Elke groep werkt anders. Begin klein en zet aan wat je nodig hebt.'));
  kop.appendChild(tekst);
  kop.appendChild(knop('Eenvoudig', 'stil', function () {
    Object.assign(k.settings, { timerAan:true, wachtrijAan:false, tellingAan:false,
                                werkplaatsAan:false, signaleringAan:false });
    bewaarOfKlaag(); teken(); meld('Op eenvoudig gezet');
  }));
  kop.appendChild(knop('Uitgebreid', 'primair', function () {
    Object.assign(k.settings, { timerAan:true, wachtrijAan:true, tellingAan:true,
                                werkplaatsAan:true, signaleringAan:true });
    bewaarOfKlaag(); teken(); meld('Op uitgebreid gezet');
  }));
  snel.appendChild(kop);
  v.appendChild(snel);

  var rooster = el('div', 'rooster2');

  var bord = paneel('Op het bord');
  FUNCTIES_BORD.forEach(function (f) { bord.appendChild(functieRij(k, f[0], f[1], f[2])); });
  var legen = el('div');
  legen.style.cssText = 'padding:14px 2px 4px;border-top:1px solid var(--vlak-2);margin-top:6px';
  legen.appendChild(el('div', 'rij-naam', 'Wanneer loopt het bord leeg?'));
  legen.appendChild(el('div', 'rij-sub',
    'Wat gekozen is wordt bewaard voor de statistieken; alleen het bord zelf begint blanco.'));
  var legenChips = el('div', 'chips');
  legenChips.style.marginTop = '10px';
  [['dag', 'Elke ochtend'], ['dagdeel', 'Per dagdeel'], ['nooit', 'Ik doe het zelf']]
    .forEach(function (paar) {
      var aan = KB.instelling('bordLegen', k) === paar[0];
      var c = el('button', 'chip' + (aan ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        k.settings.bordLegen = paar[0]; bewaarOfKlaag(); teken();
      });
      legenChips.appendChild(c);
    });
  legen.appendChild(legenChips);
  if (KB.instelling('bordLegen', k) === 'dagdeel') {
    var uurVak = el('div');
    uurVak.style.marginTop = '12px';
    uurVak.appendChild(el('div', 'rij-sub', 'Het middagdeel begint om:'));
    var uurTeller = teller(KB.instelling('dagdeelUur', k) || 12, 8, 17, function (n) {
      k.settings.dagdeelUur = n; bewaarOfKlaag();
    });
    uurTeller.style.marginTop = '8px';
    uurVak.appendChild(uurTeller);
    legen.appendChild(uurVak);
  }
  bord.appendChild(legen);

  var duur = el('div');
  duur.style.cssText = 'padding:14px 2px 4px;border-top:1px solid var(--vlak-2);margin-top:6px';
  duur.appendChild(el('div', 'rij-naam', 'Speelduur in minuten'));
  duur.appendChild(el('div', 'rij-sub', 'Geldt voor alle hoeken zonder eigen tijd.'));
  var t = teller(KB.instelling('timerMinuten', k), 1, 60, function (n) {
    k.settings.timerMinuten = n; bewaarOfKlaag();
  });
  t.style.marginTop = '10px';
  duur.appendChild(t);
  bord.appendChild(duur);
  rooster.appendChild(bord);

  var beheer = paneel('In het beheer');
  FUNCTIES_BEHEER.forEach(function (f) { beheer.appendChild(functieRij(k, f[0], f[1], f[2])); });
  rooster.appendChild(beheer);

  v.appendChild(rooster);

  v.appendChild(backupPaneel());

  var kluis = paneel('Foto\'s op dit apparaat');
  var stand = el('p', 'hint', 'Bezig met kijken…');
  kluis.appendChild(stand);
  KB.fkLees().then(function (m) {
    var n = m ? Object.keys(m).length : 0;
    stand.textContent = n ? n + " foto's staan op dit apparaat."
      : "Er staan nog geen foto's op dit apparaat. Kinderen krijgen een gekleurde cirkel met hun beginletter.";
  }).catch(function (e) {
    stand.textContent = 'Fotokluis niet beschikbaar (' + (e.message || 'onbekend') + ').';
  });
  var kluisRij = el('div', 'knoprij');
  kluisRij.style.marginTop = '12px';
  kluisRij.appendChild(bestandKnop('Kluisbestand importeren', 'application/json,.json', false, function (f) {
    var r = new FileReader();
    r.onload = function (e) {
      var pak; try { pak = JSON.parse(e.target.result); } catch (err) { meld('Onleesbaar bestand'); return; }
      if (!pak || pak.formaat !== 'keuzebord-fotokluis') { meld('Dit is geen fotokluis-bestand'); return; }
      var map = pak.fotos || {};
      KB.fkBewaar(map).then(function () {
        KB.fkPasToe(map); bewaarOfKlaag(); teken();
        meld(Object.keys(map).length + " foto's op dit apparaat gezet");
      }).catch(function () { meld('Opslaan mislukt'); });
    };
    r.readAsText(f);
  }));
  kluisRij.appendChild(knop("Foto's wissen van dit apparaat", 'gevaar', function () {
    vraagBevestiging("Foto's wissen?",
      "De foto's verdwijnen alleen van dit apparaat.", 'Wissen', function () {
        KB.fkWis().then(function () {
          KB.G.klassen.forEach(function (g) {
            (g.leerlingen || []).forEach(function (l) { if (l._c) l.image = null; });
            (g.fotoLib || []).forEach(function (f) { if (f._c) f.data = null; });
          });
          bewaarOfKlaag(); teken(); meld("Foto's gewist");
        }).catch(function () { meld('Wissen mislukt'); });
      });
  }));
  kluis.appendChild(kluisRij);
  v.appendChild(kluis);
};

function backupTekst(){
  var dagen = KB.dagenSindsBackup();
  if (dagen === null) return { tekst:'Je hebt nog geen back-up gemaakt.', dringend:true };
  if (dagen === 0)    return { tekst:'Laatste back-up: vandaag.', dringend:false };
  if (dagen === 1)    return { tekst:'Laatste back-up: gisteren.', dringend:false };
  return { tekst:'Laatste back-up: ' + dagen + ' dagen geleden.', dringend: dagen >= 14 };
}

/* Is dit apparaat met de server verbonden? Dat verandert wat een back-up
   betekent: op de server is hij een extra, zonder server is hij alles. */
function opServer(){
  return !!(window.KBV && window.SB && SB.ingelogd() && KBV.groepId());
}

function backupPaneel(){
  var p = paneel('Back-up');
  var stand = backupTekst();
  if (opServer()) {
    p.appendChild(el('p', 'hint',
      'Je werk staat op de server en gaat vanzelf mee naar je andere apparaten. ' +
      'Een back-up hoeft dus niet, maar kan wel: je krijgt er een bestand mee in ' +
      'handen dat je zelf bewaart, met de groepen, kinderen, planning, doelen, ' +
      'observaties en de foto\'s. Handig voor het archief aan het eind van een jaar.'));
    if (stand.tekst.indexOf('Laatste') === 0) p.appendChild(el('p', 'hint', stand.tekst));
  } else {
    p.appendChild(el('p', 'hint', stand.tekst +
      ' Dit apparaat is niet met de server verbonden, dus alles staat in de browser. ' +
      'Een back-up is dan je enige vangnet: hij bevat de groepen, kinderen, planning, ' +
      'doelen, observaties en de foto\'s.'));
    if (stand.dringend) {
      var waarschuwing = el('div', 'signaal');
      waarschuwing.appendChild(el('div', 'signaal-kop', 'Maak even een back-up'));
      waarschuwing.appendChild(el('div', 'hint',
        'Raakt dit apparaat kwijt of wordt de browser opgeschoond, dan is je werk weg.'));
      p.appendChild(waarschuwing);
    }
  }
  var rij = el('div', 'knoprij');
  rij.appendChild(knop('Back-up downloaden', 'primair', downloadBackup));
  rij.appendChild(bestandKnop('Back-up terugzetten', 'application/json,.json', false, terugzetten));
  p.appendChild(rij);
  return p;
}

function downloadBackup(){
  toonBlad(function (blad) {
    blad.appendChild(bladTitel('Back-up downloaden',
      'Geef een wachtwoord als het bestand dit apparaat verlaat — op een USB-stick, ' +
      'in de mail of in een schoolomgeving. Er staan namen en foto\'s van kinderen in.'));
    var veld = el('div', 'veld');
    veld.appendChild(el('label', null, 'Wachtwoord (leeg = onversleuteld)'));
    var invoer = el('input');
    invoer.type = 'password'; invoer.autocomplete = 'new-password';
    veld.appendChild(invoer);
    veld.appendChild(el('p', 'hint',
      'Kwijt is kwijt: zonder wachtwoord is een versleuteld bestand niet meer te openen.'));
    blad.appendChild(veld);
    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Downloaden', 'primair', function () {
      var ww = invoer.value || '';
      KB.downloadBackup(ww).then(function (uit) {
        sluitBlad(); teken();
        meld('Back-up gedownload · ' + uit.kb + ' KB');
      }).catch(function (e) { meld('Lukte niet: ' + (e.message || 'onbekend')); });
    }));
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    blad.appendChild(rij);
    setTimeout(function () { invoer.focus(); }, 60);
  });
}

function terugzetten(file){
  KB.leesBackupBestand(file, vraagWachtwoord).then(function (pak) {
    var aantal = (pak.gegevens && pak.gegevens.klassen) ? pak.gegevens.klassen.length : 0;
    vraagBevestiging('Back-up terugzetten?',
      'Deze back-up bevat ' + aantal + ' groepen, gemaakt op ' +
      (pak.gemaakt || '').slice(0, 10) + '. Alles wat nu op dit apparaat staat wordt vervangen. ' +
      'Dit kan niet terug.',
      'Terugzetten', function () {
        KB.zetBackupTerug(pak).then(function () {
          tekenMenu(); teken(); meld('Back-up teruggezet');
        }).catch(function (e) { meld('Lukte niet: ' + (e.message || 'onbekend')); });
      });
  }).catch(function (e) { meld(e.message || 'Lukte niet'); });
}

function vraagWachtwoord(){
  return new Promise(function (res) {
    toonBlad(function (blad) {
      blad.appendChild(bladTitel('Wachtwoord van de back-up'));
      var veld = el('div', 'veld');
      veld.appendChild(el('label', null, 'Wachtwoord'));
      var invoer = el('input'); invoer.type = 'password'; invoer.autocomplete = 'current-password';
      veld.appendChild(invoer);
      blad.appendChild(veld);
      var rij = el('div', 'knoprij');
      rij.appendChild(knop('Openen', 'primair', function () {
        var v = invoer.value || ''; sluitBlad(); res(v);
      }));
      rij.appendChild(knop('Annuleren', 'stil', function () { sluitBlad(); res(''); }));
      blad.appendChild(rij);
      setTimeout(function () { invoer.focus(); }, 60);
    });
  });
}

function functieRij(k, sleutel, naam, uitleg){
  var rij = el('div', 'rij');
  var tekst = el('div');
  tekst.style.flexGrow = '1';
  tekst.appendChild(el('div', 'rij-naam', naam));
  tekst.appendChild(el('div', 'rij-sub', uitleg));
  rij.appendChild(tekst);
  rij.appendChild(schakelaar(KB.instelling(sleutel, k), function (aan) {
    k.settings[sleutel] = aan; bewaarOfKlaag();
  }));
  return rij;
}

/* ── naar buiten, voor kb-plan.js ────────────────────────── */
/* Onderin de zijbalk: wie er is ingelogd, met de weg naar buiten. Een
   schoolbeheerder die hier via het schoolbeheer terechtkwam krijgt er de
   weg terug bij. */
function zetAccountknop(){
  var vak = document.getElementById('zij-onder');
  if (!vak || !window.KBV) return;
  var oud = vak.querySelector('.account');
  if (oud) oud.parentNode.removeChild(oud);

  var wie = KBV.wie();
  if (!wie || !wie.profiel) return;

  var extra = [];
  if (wie.profiel.rol === 'schoolbeheerder') {
    extra.push({ tekst: 'Naar het schoolbeheer',
                 doen: function () { location.href = 'school.html'; } });
  }
  var knop = KBV.maakAccountknop({ klasse: 'omhoog', extra: extra });
  if (knop) vak.insertBefore(knop, vak.firstChild);
}

global.BH = {
  zetAccountknop: zetAccountknop,
  $:$, el:el, leeg:leeg, meld:meld, bewaarOfKlaag:bewaarOfKlaag,
  toonBlad:toonBlad, sluitBlad:sluitBlad, vraagBevestiging:vraagBevestiging, bladTitel:bladTitel,
  paneel:paneel, knop:knop, schakelaar:schakelaar, teller:teller,
  pictoBol:pictoBol, kindKaart:kindKaart, kopregel:kopregel, leegBericht:leegBericht,
  bestandKnop:bestandKnop,
  panelen:panelen, ga:ga, teken:teken, tekenMenu:tekenMenu,
  start: function () {
    var start = (location.hash || '').replace('#', '');
    if (ONDERDELEN.some(function (o) { return o.id === start; })) huidig = start;
    $('overlay').addEventListener('click', function (e) { if (e.target.id === 'overlay') sluitBlad(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluitBlad(); });
      // Deze omgeving hoort bij \u00e9\u00e9n groep: die van dit apparaat.
    var gebonden = KB.beheerKlasId();
    if (gebonden) KB.G.activeKlasId = gebonden;

    (window.KBV ? KBV.zodraKlaar() : Promise.resolve({ lokaal:true }))
      .then(function () {
        var gekozen = KB.beheerKlasId();
        if (gekozen) KB.G.activeKlasId = gekozen;
        zetAccountknop();
        return KB.fkLees();
      })
      .then(function (m) { if (m) KB.fkPasToe(m); })
      .catch(function () {})
      .then(function () { tekenMenu(); teken(); });
  }
};

})(window);
