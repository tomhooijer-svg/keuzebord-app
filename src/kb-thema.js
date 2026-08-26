/* ══════════════════════════════════════════════════════════════
   THEMA'S
   Thematisch onderzoekend leren begint niet bij een doel maar bij
   verwondering. Een kind ziet iets, vraagt zich iets af, en daar
   ga je samen achteraan. Pas daarna kijkt de juf welke doelen ze
   onderweg kan raken.

   Dit scherm houdt die volgorde aan. Je werkt een thema vooruit
   uit -- verwonderen, vragen, onderzoeken, betekenis geven -- en
   plant hem later in een week in. Alles wat je maakt hangt eraan:
   de doelen, de activiteiten, de taken en de hoeken.
   ══════════════════════════════════════════════════════════════ */
(function (){
'use strict';

var el = BH.el, knop = BH.knop, paneel = BH.paneel, leeg = BH.leeg;
var teken = BH.teken, meld = BH.meld, bewaar = BH.bewaarOfKlaag;

var open = null;        // welk thema staat open
var stap = 'verwonder'; // welke beweging je bekijkt
var toonArchief = false;

var STAPPEN = [
  { id:'verwonder', naam:'Verwonderen',
    uitleg:'Waar begint dit thema? Iets wat de kinderen raakt: een voorwerp op de tafel, ' +
           'een verhaal, een brief, een uitstapje. Nog geen doelen — eerst de verwondering.' },
  { id:'vragen',    naam:'Vragen',
    uitleg:'Wat willen de kinderen weten? Die vragen komen van hen; jij vangt ze op. ' +
           'Ze sturen de rest van het thema, dus hier komen ze te staan.' },
  { id:'onderzoek', naam:'Onderzoeken',
    uitleg:'Hoe gaan we het uitzoeken? De hoeken die je inricht, de activiteiten die je doet, ' +
           'de taken in de werkplaats — en de doelen die je onderweg raakt.' },
  { id:'betekenis', naam:'Betekenis geven',
    uitleg:'Wat hebben we ontdekt, en aan wie laten we het zien? De afsluiting van het thema.' }
];

/* Via het menu binnenkomen betekent: laat me de lijst zien. Wie een
   thema wil openen klikt hem aan. */
BH.alsJeBinnenkomt('themas', function () { open = null; stap = 'verwonder'; });

/* ── de lijst ─────────────────────────────────────────────── */

BH.panelen.themas = function (v){
  var k = KB.klas();
  var alle = KB.themas(k);
  var lopend = alle.filter(function (t) { return !t.archief; });
  var oud = alle.filter(function (t) { return t.archief; });

  v.appendChild(BH.kopregel("Thema's",
    'Waar je de komende weken samen achteraan gaat',
    knop('Thema beginnen', 'primair', function () { nieuwThemaBlad(); })));

  if (open) { toonThema(v, open, k); return; }

  if (!lopend.length && !oud.length) {
    var p0 = paneel();
    p0.appendChild(BH.leegBericht(
      'Nog geen thema. Een thema begint bij iets wat de kinderen verwondert — een nest op ' +
      'het plein, een brief van de kabouter, de eerste sneeuw. Daar komen hun vragen uit, ' +
      'en daar hang je je hoeken, activiteiten, taken en doelen aan.',
      knop('Thema beginnen', 'primair', function () { nieuwThemaBlad(); })));
    v.appendChild(p0);
    return;
  }

  var nu = KB.weekSleutel();
  if (lopend.length) {
    var p = paneel('In de maak');
    lopend.slice().sort(function (a, b) {
      return (a.van || '9999') < (b.van || '9999') ? -1 : 1;
    }).forEach(function (t) { p.appendChild(themaRij(t, k, nu)); });
    v.appendChild(p);
  }

  if (oud.length) {
    var p2 = paneel('Geweest', knop(toonArchief ? 'Inklappen' : 'Laten zien', 'stil', function () {
      toonArchief = !toonArchief; teken();
    }));
    p2.appendChild(el('p', 'hint', oud.length + (oud.length === 1 ? ' thema' : " thema's") +
      ' uit eerdere periodes. Je kunt ze openen om er iets uit over te nemen.'));
    if (toonArchief) oud.forEach(function (t) { p2.appendChild(themaRij(t, k, nu)); });
    v.appendChild(p2);
  }
};

function themaRij(t, k, nu){
  var st = KB.themaStand(t, k);
  var rij = el('button', 'themarij');
  var stip = el('span', 'stip');
  stip.style.background = t.kleur || 'var(--accent)';
  rij.appendChild(stip);

  var tekst = el('div', 'themarij-tekst');
  var titel = el('div', 'rij-naam', t.naam);
  if (t.van && t.tot && nu >= t.van && nu <= t.tot) {
    titel.appendChild(el('span', 'merkje', 'deze week'));
  }
  tekst.appendChild(titel);
  tekst.appendChild(el('div', 'rij-sub', t.vraag || periodeZin(t) || 'nog geen onderzoeksvraag'));

  var mc = el('div', 'minichips');
  [[st.vragen, 'vragen'], [st.doelen, 'doelen'], [st.activiteiten, 'activiteiten'],
   [st.taken, 'taken'], [st.hoeken, 'hoeken']].forEach(function (paar) {
    mc.appendChild(el('span', 'minichip' + (paar[0] ? '' : ' ongevuld'), paar[0] + ' ' + paar[1]));
  });
  tekst.appendChild(mc);
  rij.appendChild(tekst);

  rij.addEventListener('click', function () { open = t.id; stap = 'verwonder'; teken(); });
  return rij;
}

function periodeZin(t){
  if (!t.van && !t.tot) return '';
  if (t.van && t.tot) return datum(t.van) + ' tot ' + datum(t.tot);
  return t.van ? 'vanaf ' + datum(t.van) : 'tot ' + datum(t.tot);
}
function datum(d){
  if (!d) return '';
  var p = String(d).split('-');
  if (p.length !== 3) return d;
  var maanden = ['januari','februari','maart','april','mei','juni','juli',
                 'augustus','september','oktober','november','december'];
  return Number(p[2]) + ' ' + maanden[Number(p[1]) - 1];
}

/* ── één thema, langs de vier bewegingen ──────────────────── */

function toonThema(v, themaId, k){
  var t = KB.themaVan(themaId, k);
  if (!t) { open = null; teken(); return; }

  var terug = knop('Alle thema’s', 'stil', function () { open = null; teken(); });
  var kop = el('div', 'kopregel');
  var links = el('div');
  var naamRegel = el('div', 'titel', t.naam);
  links.appendChild(naamRegel);
  links.appendChild(el('div', 'ondertitel', t.vraag || periodeZin(t) || 'nog geen onderzoeksvraag'));
  kop.appendChild(links);
  var rechts = el('div', 'knoprij');
  rechts.appendChild(terug);
  rechts.appendChild(knop('Bewerken', 'stil', function () { nieuwThemaBlad(t); }));
  kop.appendChild(rechts);
  v.appendChild(kop);

  /* de vier bewegingen als stappenbalk */
  var balk = el('div', 'stappen');
  STAPPEN.forEach(function (s, i) {
    var b = el('button', 'stap' + (s.id === stap ? ' aan' : ''));
    b.appendChild(el('span', 'stap-nr', String(i + 1)));
    b.appendChild(el('span', 'stap-naam', s.naam));
    b.addEventListener('click', function () { stap = s.id; teken(); });
    balk.appendChild(b);
  });
  v.appendChild(balk);

  var deze = STAPPEN.filter(function (s) { return s.id === stap; })[0];
  var uitleg = paneel();
  uitleg.appendChild(el('p', 'hint', deze.uitleg));
  v.appendChild(uitleg);

  if (stap === 'verwonder') verwonderStap(v, t, k);
  if (stap === 'vragen')    vragenStap(v, t, k);
  if (stap === 'onderzoek') onderzoekStap(v, t, k);
  if (stap === 'betekenis') betekenisStap(v, t, k);
}

/* ── 1. verwonderen ───────────────────────────────────────── */

function verwonderStap(v, t, k){
  var p = paneel('De start');
  p.appendChild(schrijfVeld('Waarmee begin je?',
    'Bijvoorbeeld: er staat een koffer midden in de kring, met daarin een verrekijker, ' +
    'een kaart en een veer.',
    t.start, function (w) { t.start = w; bewaar(); }));
  v.appendChild(p);

  var p2 = paneel('De onderzoeksvraag');
  p2.appendChild(regelVeld('De vraag waar dit thema om draait',
    'Waarom vallen de blaadjes van de boom?',
    t.vraag, function (w) { t.vraag = w; bewaar(); }));
  p2.appendChild(el('p', 'hint',
    'Eén vraag die het hele thema draagt. De vragen van de kinderen zelf komen bij de ' +
    'volgende stap; deze is van jou.'));
  v.appendChild(p2);

  v.appendChild(periodePaneel(t, k));
}

function periodePaneel(t, k){
  var p = paneel('Wanneer');
  p.appendChild(el('p', 'hint',
    'Mag leeg blijven. Vul je het in, dan weet het weekplan vanzelf welk thema er die ' +
    'week loopt en zie je het op het Vandaag-scherm terug.'));
  var rij = el('div', 'datumrij');
  [['van', 'Eerste week'], ['tot', 'Laatste week']].forEach(function (paar) {
    var vak = el('div', 'veld');
    vak.appendChild(el('label', null, paar[1]));
    var inv = el('input');
    inv.type = 'date';
    inv.value = t[paar[0]] || '';
    inv.addEventListener('change', function () {
      t[paar[0]] = inv.value || null;
      bewaar(); teken();
    });
    vak.appendChild(inv);
    rij.appendChild(vak);
  });
  p.appendChild(rij);

  var nu = KB.weekSleutel();
  var w = KB.week(nu, k);
  var loopt = w.themaId === t.id;
  var actie = el('div', 'knoprij');
  actie.appendChild(knop(loopt ? 'Deze week losmaken' : 'Deze week hierop zetten',
    loopt ? 'stil' : 'primair', function () {
      w.themaId = loopt ? null : t.id;
      bewaar(); teken();
      meld(loopt ? 'Losgemaakt van deze week' : t.naam + ' loopt deze week');
    }));
  p.appendChild(actie);
  return p;
}

/* ── 2. de vragen van de kinderen ─────────────────────────── */

function vragenStap(v, t, k){
  if (!t.vragen) t.vragen = [];
  var p = paneel('De vragenmuur', knop('Vraag erbij', 'primair', function () {
    t.vragen.push({ id:'v' + KB.uid(), tekst:'', van:'kind', beantwoord:false });
    bewaar(); teken();
  }));

  if (!t.vragen.length) {
    p.appendChild(el('p', 'hint',
      'Nog geen vragen. Schrijf op wat de kinderen zich afvragen, ook de vragen waar je ' +
      'zelf het antwoord niet op weet — juist die.'));
  }

  t.vragen.forEach(function (vr, i) {
    var rij = el('div', 'vraagrij' + (vr.beantwoord ? ' af' : ''));

    var vink = el('button', 'vraagvink' + (vr.beantwoord ? ' aan' : ''));
    vink.textContent = vr.beantwoord ? '✓' : '';
    vink.title = vr.beantwoord ? 'Weer openzetten' : 'We weten het antwoord';
    vink.addEventListener('click', function () {
      vr.beantwoord = !vr.beantwoord; bewaar(); teken();
    });
    rij.appendChild(vink);

    var inv = el('textarea');
    inv.className = 'vraagtekst';
    inv.rows = 1;
    inv.value = vr.tekst;
    inv.placeholder = 'Waarom is de maan soms rond en soms een streepje?';
    inv.addEventListener('input', function () {
      vr.tekst = inv.value; groei(inv); bewaar();
    });
    rij.appendChild(inv);
    setTimeout(function () { groei(inv); if (!vr.tekst) inv.focus(); }, 0);

    var wie = el('button', 'vraagwie', vr.van === 'kind' ? 'van een kind' : 'van de juf');
    wie.title = 'Van wie komt deze vraag?';
    wie.addEventListener('click', function () {
      vr.van = vr.van === 'kind' ? 'juf' : 'kind'; bewaar(); teken();
    });
    rij.appendChild(wie);

    var weg = el('button', 'vraagweg', '×');
    weg.title = 'Weghalen';
    weg.addEventListener('click', function () {
      t.vragen.splice(i, 1); bewaar(); teken();
    });
    rij.appendChild(weg);

    p.appendChild(rij);
  });
  v.appendChild(p);

  var st = KB.themaStand(t, k);
  if (st.vragen) {
    var p2 = paneel();
    p2.appendChild(el('p', 'hint',
      st.beantwoord + ' van de ' + st.vragen + ' vragen ' +
      (st.beantwoord === 1 ? 'is' : 'zijn') + ' beantwoord. ' +
      (st.beantwoord === st.vragen
        ? 'Alles opgelost — tijd om af te sluiten, of om door te vragen.'
        : 'De open vragen zijn je aanknopingspunten voor de volgende activiteit.')));
    v.appendChild(p2);
  }
}

function groei(t){ t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

/* ── 3. onderzoeken: hoeken, activiteiten, taken, doelen ──── */

function onderzoekStap(v, t, k){
  v.appendChild(hoekenPaneel(t, k));
  v.appendChild(activiteitenPaneel(t, k));
  v.appendChild(takenPaneel(t, k));
  v.appendChild(doelenPaneel(t, k));
}

function hoekenPaneel(t, k){
  var p = paneel('Hoeken bij dit thema');
  if (!t.hoekIds) t.hoekIds = [];
  var alle = k.hoekLib || [];
  if (!alle.length) {
    p.appendChild(el('p', 'hint', 'Deze groep heeft nog geen hoeken.'));
    return p;
  }
  p.appendChild(el('p', 'hint',
    'Welke hoeken richt je op dit thema in? De basis blijft staan — je verrijkt hem met ' +
    'materiaal uit het thema.'));
  var chips = el('div', 'chips');
  alle.forEach(function (h) {
    var aan = t.hoekIds.indexOf(h.id) >= 0;
    var lijnen = KB.hoekLeerlijnen(h);
    var c = el('button', 'chip' + (aan ? ' aan' : ''), h.naam);
    if (lijnen.length) c.title = lijnen.join(', ');
    c.addEventListener('click', function () {
      t.hoekIds = aan ? t.hoekIds.filter(function (id) { return id !== h.id; })
                      : t.hoekIds.concat([h.id]);
      bewaar(); teken();
    });
    chips.appendChild(c);
  });
  p.appendChild(chips);

  /* waar raken die hoeken samen aan? */
  var gekozen = KB.hoekenVanThema(t, k);
  if (gekozen.length) {
    var geraakt = [];
    gekozen.forEach(function (h) {
      KB.hoekLeerlijnen(h).forEach(function (l) { if (geraakt.indexOf(l) < 0) geraakt.push(l); });
    });
    if (geraakt.length) {
      var mc = el('div', 'minichips');
      mc.style.marginTop = '12px';
      geraakt.forEach(function (l) { mc.appendChild(el('span', 'minichip', l)); });
      p.appendChild(el('div', 'rij-sub', 'Samen raken deze hoeken aan:'));
      p.appendChild(mc);
    } else {
      p.appendChild(el('p', 'hint',
        'Deze hoeken zijn nog niet ingedeeld. Vink bij Hoeken aan waar ze voor zijn, ' +
        'dan zie je hier waar dit thema aan raakt.'));
    }
  }
  return p;
}

function activiteitenPaneel(t, k){
  if (!t.activiteiten) t.activiteiten = [];
  var p = paneel('Activiteiten', knop('Activiteit erbij', 'primair', function () {
    t.activiteiten.push({ id:'a' + KB.uid(), naam:'', soort:'kring',
                          omschrijving:'', gedaan:false });
    bewaar(); teken();
  }));
  p.appendChild(el('p', 'hint',
    'Wat je samen doet: in de kring, met een klein groepje, buiten. Anders dan een taak — ' +
    'een taak wordt per kind ingepland in de werkplaats, een activiteit doe je samen.'));

  if (!t.activiteiten.length) {
    p.appendChild(el('p', 'hint', 'Nog geen activiteiten.'));
    return p;
  }

  t.activiteiten.forEach(function (a, i) {
    var vak = el('div', 'activiteit' + (a.gedaan ? ' af' : ''));

    var boven = el('div', 'activiteit-boven');
    var vink = el('button', 'vraagvink' + (a.gedaan ? ' aan' : ''));
    vink.textContent = a.gedaan ? '✓' : '';
    vink.title = a.gedaan ? 'Toch nog niet gedaan' : 'Gedaan';
    vink.addEventListener('click', function () { a.gedaan = !a.gedaan; bewaar(); teken(); });
    boven.appendChild(vink);

    var naam = el('input');
    naam.className = 'activiteit-naam';
    naam.type = 'text'; naam.value = a.naam;
    naam.placeholder = 'Wat gaan we doen?';
    naam.addEventListener('input', function () { a.naam = naam.value; bewaar(); });
    boven.appendChild(naam);

    var soort = el('select');
    soort.className = 'activiteit-soort';
    KB.ACTIVITEITSOORTEN.forEach(function (s) {
      var o = el('option', null, s.naam); o.value = s.id;
      if (s.id === a.soort) o.selected = true;
      soort.appendChild(o);
    });
    soort.addEventListener('change', function () { a.soort = soort.value; bewaar(); });
    boven.appendChild(soort);

    var weg = el('button', 'vraagweg', '×');
    weg.title = 'Weghalen';
    weg.addEventListener('click', function () { t.activiteiten.splice(i, 1); bewaar(); teken(); });
    boven.appendChild(weg);
    vak.appendChild(boven);

    var uitleg = el('textarea');
    uitleg.className = 'activiteit-uitleg';
    uitleg.rows = 1;
    uitleg.value = a.omschrijving;
    uitleg.placeholder = 'Wat heb je nodig, en wat is de bedoeling? (mag leeg)';
    uitleg.addEventListener('input', function () {
      a.omschrijving = uitleg.value; groei(uitleg); bewaar();
    });
    vak.appendChild(uitleg);
    setTimeout(function () { groei(uitleg); if (!a.naam) naam.focus(); }, 0);

    p.appendChild(vak);
  });
  return p;
}

function takenPaneel(t, k){
  var mijn = KB.takenVanThema(t.id, k);
  var los = KB.taken(k).filter(function (x) { return !x.themaId; });
  var p = paneel('Taken in de werkplaats', knop('Taak maken', 'primair', function () {
    var nieuw = KB.nieuweTaak({ naam:'Nieuwe taak' }, k);
    nieuw.themaId = t.id;
    bewaar();
    BH.ga('taken');
    meld('Taak gemaakt bij ' + t.naam + ' — werk hem hier af');
  }));
  p.appendChild(el('p', 'hint',
    'Werk waar elk kind een keer aan toekomt. Het weekplan verdeelt ze over de dagen.'));

  if (!mijn.length) {
    p.appendChild(el('p', 'hint', 'Nog geen taken bij dit thema.'));
  } else {
    mijn.forEach(function (x) {
      var rij = el('div', 'rij');
      var stip = el('span', 'stip');
      stip.style.background = x.kleur || 'var(--accent)';
      rij.appendChild(stip);
      var tekst = el('div');
      tekst.style.flexGrow = '1';
      tekst.appendChild(el('div', 'rij-naam', x.naam));
      tekst.appendChild(el('div', 'rij-sub',
        x.plekken + ' kinderen tegelijk · ' +
        ((x.doelIds || []).length || 'geen') + ' doel' +
        ((x.doelIds || []).length === 1 ? '' : 'en')));
      rij.appendChild(tekst);
      var acties = el('div', 'rij-acties');
      acties.appendChild(knop('Losmaken', 'stil', function () {
        x.themaId = null; bewaar(); teken();
      }));
      rij.appendChild(acties);
      p.appendChild(rij);
    });
  }

  if (los.length) {
    p.appendChild(el('div', 'rij-sub', 'Taken zonder thema — aanklikken om ze hieraan te hangen:'));
    var chips = el('div', 'chips');
    los.forEach(function (x) {
      var c = el('button', 'chip', x.naam);
      c.addEventListener('click', function () { x.themaId = t.id; bewaar(); teken(); });
      chips.appendChild(c);
    });
    p.appendChild(chips);
  }
  return p;
}

function doelenPaneel(t, k){
  if (!t.doelIds) t.doelIds = [];
  var p = paneel('Doelen waar je aan werkt', knop('Doelen kiezen', 'primair', function () {
    BH.kiesDoelen({
      gekozen: t.doelIds.slice(),
      tekst: [t.naam, t.vraag, t.start,
              (t.activiteiten || []).map(function (a) { return a.naam + ' ' + a.omschrijving; }).join(' ')
             ].join(' '),
      klaar: function (ids) { t.doelIds = ids; bewaar(); teken(); }
    });
  }));
  p.appendChild(el('p', 'hint',
    'Bij thematisch onderzoekend leren komen de doelen ná de vraag: je kijkt welke ' +
    'doelen je onderweg kunt raken, niet andersom. De suggesties kijken mee met wat je ' +
    'hierboven hebt opgeschreven.'));

  if (!t.doelIds.length) {
    p.appendChild(el('p', 'hint', 'Nog geen doelen gekozen.'));
    return p;
  }
  var lijst = el('div', 'gekozendoelen');
  t.doelIds.forEach(function (id) {
    var d = (KB.doelen.lijst || []).filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    var chip = el('div', 'doelchip');
    var tekst = el('div');
    tekst.style.flexGrow = '1';
    tekst.appendChild(el('div', null, (d.aspect ? d.aspect + ': ' : '') + d.doel));
    tekst.appendChild(el('div', 'rij-sub', d.niveau + ' · ' + d.domein + ' · ' + d.leerlijn));
    chip.appendChild(tekst);
    var weg = el('button', 'vraagweg', '×');
    weg.addEventListener('click', function () {
      t.doelIds = t.doelIds.filter(function (x) { return x !== id; });
      bewaar(); teken();
    });
    chip.appendChild(weg);
    lijst.appendChild(chip);
  });
  p.appendChild(lijst);
  return p;
}

/* ── 4. betekenis geven ───────────────────────────────────── */

function betekenisStap(v, t, k){
  var p = paneel('De afsluiting');
  p.appendChild(schrijfVeld('Hoe sluiten jullie af?',
    'Bijvoorbeeld: de kinderen laten hun museum zien aan groep 3, of aan de ouders ' +
    'bij het ophalen.',
    t.afsluiting, function (w) { t.afsluiting = w; bewaar(); }));
  v.appendChild(p);

  var st = KB.themaStand(t, k);
  var p2 = paneel('Waar staat dit thema');
  [['Startactiviteit', st.heeftStart, 'Nog niets opgeschreven bij Verwonderen'],
   ['Onderzoeksvraag', !!(t.vraag || '').trim(), 'Nog geen vraag die het thema draagt'],
   ['Vragen van de kinderen', st.vragen > 0, 'De vragenmuur is nog leeg'],
   ['Hoeken ingericht', st.hoeken > 0, 'Nog geen hoeken aan dit thema gehangen'],
   ['Activiteiten', st.activiteiten > 0, 'Nog geen activiteiten'],
   ['Taken', st.taken > 0, 'Nog geen taken in de werkplaats'],
   ['Doelen', st.doelen > 0, 'Nog geen doelen gekozen'],
   ['Afsluiting', st.heeftAfsluiting, 'Nog niets opgeschreven']
  ].forEach(function (r) {
    var rij = el('div', 'checkrij' + (r[1] ? ' goed' : ''));
    rij.appendChild(el('span', 'checkmerk', r[1] ? '✓' : '·'));
    var tekst = el('div', 'checktekst');
    tekst.appendChild(el('div', 'rij-naam', r[0]));
    if (!r[1]) tekst.appendChild(el('div', 'rij-sub', r[2]));
    rij.appendChild(tekst);
    p2.appendChild(rij);
  });
  p2.appendChild(el('p', 'hint',
    'Niet alles hoeft ingevuld. Een thema dat halverwege een andere kant op gaat omdat de ' +
    'kinderen iets anders willen weten, is geen mislukt thema.'));
  v.appendChild(p2);

  var p3 = paneel();
  var rij3 = el('div', 'knoprij');
  rij3.appendChild(knop(t.archief ? 'Weer in de maak zetten' : 'Thema afsluiten', 'stil', function () {
    t.archief = !t.archief; bewaar();
    if (t.archief) { open = null; meld(t.naam + ' is afgesloten'); }
    teken();
  }));
  p3.appendChild(rij3);
  p3.appendChild(el('p', 'hint',
    'Een afgesloten thema blijft bewaard onder "Geweest". De taken, doelen en observaties ' +
    'die eraan hingen blijven gewoon staan.'));
  v.appendChild(p3);
}

/* ── het thema zelf maken of bewerken ─────────────────────── */

function nieuwThemaBlad(t){
  var k = KB.klas(), nieuw = !t;
  var concept = { naam: t ? t.naam : '', vraag: t ? t.vraag : '',
                  kleur: (t && t.kleur) || KB.HOEKKLEUREN[KB.themas(k).length % KB.HOEKKLEUREN.length] };

  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel(nieuw ? 'Nieuw thema' : 'Thema bewerken',
      nieuw ? 'Een naam is genoeg om te beginnen. De rest werk je daarna uit.' : ''));

    var naamVeld = el('div', 'veld');
    naamVeld.appendChild(el('label', null, 'Naam van het thema'));
    var inv = el('input'); inv.type = 'text'; inv.value = concept.naam;
    inv.placeholder = 'De herfst, Op reis, Wat kruipt daar?';
    inv.addEventListener('input', function () { concept.naam = inv.value; });
    naamVeld.appendChild(inv);
    blad.appendChild(naamVeld);

    var vraagVeld = el('div', 'veld');
    vraagVeld.appendChild(el('label', null, 'De onderzoeksvraag (mag later)'));
    var inv2 = el('input'); inv2.type = 'text'; inv2.value = concept.vraag;
    inv2.placeholder = 'Waarom vallen de blaadjes van de boom?';
    inv2.addEventListener('input', function () { concept.vraag = inv2.value; });
    vraagVeld.appendChild(inv2);
    blad.appendChild(vraagVeld);

    var kleurVeld = el('div', 'veld');
    kleurVeld.appendChild(el('label', null, 'Kleur'));
    var kleuren = el('div', 'chips');
    KB.HOEKKLEUREN.forEach(function (c) {
      var stipje = el('button', 'kleurstip');
      stipje.style.background = c; stipje.style.color = c;
      stipje.classList.toggle('aan', c === concept.kleur);
      stipje.addEventListener('click', function () {
        concept.kleur = c;
        Array.prototype.forEach.call(kleuren.children, function (x, i) {
          if (KB.HOEKKLEUREN[i]) x.classList.toggle('aan', KB.HOEKKLEUREN[i] === concept.kleur);
        });
      });
      kleuren.appendChild(stipje);
    });
    kleurVeld.appendChild(kleuren);
    blad.appendChild(kleurVeld);

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Opslaan', 'primair', function () {
      var naam = (concept.naam || '').trim();
      if (!naam) { meld('Geef het thema een naam'); return; }
      if (nieuw) {
        var gemaakt = KB.nieuwThema({ naam:naam, vraag:concept.vraag, kleur:concept.kleur }, k);
        open = gemaakt.id; stap = 'verwonder';
      } else {
        t.naam = naam; t.vraag = concept.vraag; t.kleur = concept.kleur;
      }
      bewaar(); BH.sluitBlad(); teken(); meld('Opgeslagen');
    }));
    rij.appendChild(knop('Annuleren', 'stil', BH.sluitBlad));
    if (!nieuw) rij.appendChild(knop('Verwijderen', 'gevaar', function () {
      BH.sluitBlad();
      BH.vraagBevestiging('Thema verwijderen?',
        t.naam + ' verdwijnt. De taken en doelen die eraan hingen blijven bestaan, ' +
        'maar horen daarna nergens meer bij.', 'Verwijderen', function () {
          KB.haalThemaWeg(t.id, k);
          open = null; bewaar(); teken(); meld('Verwijderd');
        });
    }));
    blad.appendChild(rij);
    setTimeout(function () { inv.focus(); }, 30);
  });
}

/* ── kleine bouwstenen ────────────────────────────────────── */

function schrijfVeld(label, plaats, waarde, bij){
  var vak = el('div', 'veld');
  vak.appendChild(el('label', null, label));
  var t = el('textarea');
  t.rows = 3; t.value = waarde || ''; t.placeholder = plaats;
  t.addEventListener('input', function () { bij(t.value); groei(t); });
  vak.appendChild(t);
  setTimeout(function () { groei(t); }, 0);
  return vak;
}
function regelVeld(label, plaats, waarde, bij){
  var vak = el('div', 'veld');
  vak.appendChild(el('label', null, label));
  var i = el('input');
  i.type = 'text'; i.value = waarde || ''; i.placeholder = plaats;
  i.addEventListener('input', function () { bij(i.value); });
  vak.appendChild(i);
  return vak;
}

})();
