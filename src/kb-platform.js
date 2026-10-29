/* ══════════════════════════════════════════════════════════════
   PLATFORMBEHEER
   Scholen aanmaken, accounts regelen, en per school zien hoeveel
   er gebruikt wordt. Wat hier bewust NIET staat: kinderen, borden
   en statistieken. Die zijn van de school. Zie docs/ROLLEN.md.

   Dit scherm praat alleen met de server -- er is geen lokale kopie
   van iets, want er is niets om offline mee door te werken.
   ══════════════════════════════════════════════════════════════ */
(function () {
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
/* De database weigert een actie op een school met kinderen zolang de deur
   dicht is (platform_moet_mogen in schema.sql). Dat is geen storing maar
   een afspraak, dus geen "Dat lukte niet: ..." ervoor: alleen de zin
   zelf, en wat langer in beeld, want er staat iets in om te doen. */
var DEUR_DICHT = 'Deze school heeft kinderen. Vraag de schoolbeheerder om meekijken aan te zetten.';
function meld(t){
  var dicht = String(t || '').indexOf('Deze school heeft kinderen') >= 0;
  var m = $('melding'); m.textContent = dicht ? DEUR_DICHT : t; m.classList.add('zichtbaar');
  m.classList.toggle('deur-dicht', dicht);
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(function () { m.classList.remove('zichtbaar'); }, dicht ? 8000 : 3200);
}

function toonBlad(bouw){
  var blad = leeg($('blad'));
  bouw(blad);
  $('overlay').classList.add('open');
}
/* De cursor in het eerste veld zetten, maar alleen als er nog niemand
   zelf ergens op heeft geklikt. Het wachten is voor de animatie van het
   blad; wie binnen die tijd al begint te typen zou anders zijn eerste
   tekens in het verkeerde vak zien belanden. Dat is zeldzaam voor een
   mens en gegarandeerd voor een proef, en het is allebei fout. */
function zetCursor(veld, blad){
  setTimeout(function () {
    var nu = document.activeElement;
    if (nu && nu !== document.body && blad && blad.contains(nu)) return;
    veld.focus();
  }, 60);
}

function sluitBlad(){ $('overlay').classList.remove('open'); }
$('overlay').addEventListener('click', function (e) { if (e.target.id === 'overlay') sluitBlad(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluitBlad(); });

function knop(tekst, soort, doen){
  var b = el('button', 'knop knop-' + (soort || 'stil') + ' knop-klein', tekst);
  b.addEventListener('click', doen);
  return b;
}
function kopregel(titel, onder, rechts){
  var kop = el('div', 'kopregel');
  var links = el('div');
  links.appendChild(el('div', 'titel', titel));
  if (onder) links.appendChild(el('div', 'ondertitel', onder));
  kop.appendChild(links);
  if (rechts) {
    var r = el('div', 'knoprij');
    [].concat(rechts).forEach(function (x) { r.appendChild(x); });
    kop.appendChild(r);
  }
  return kop;
}

function datum(t){
  if (!t) return '—';
  var d = new Date(t);
  return d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' }) + ' ' +
         d.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
}

/* ── wat we van de server halen ───────────────────────────────── */

var ONDERDELEN = [
  { id:'scholen', naam:'Scholen',
    icoon:'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5' },
  { id:'accounts', naam:'Accounts',
    icoon:'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.3a3.5 3.5 0 0 1 0 6.4' },
  { id:'feedback', naam:'Feedback',
    icoon:'M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.3A8.4 8.4 0 1 1 21 11.5z' },
  { id:'databank', naam:'Hoeken-databank',
    icoon:'M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6' },
  { id:'logboek', naam:'Logboek',
    icoon:'M4 5h16M4 12h16M4 19h10' }
];
var huidig = 'scholen';
var ikZelf = null;       // het eigen profiel, om jezelf geen knoppen te geven
var cijfers  = [];
var deuren   = [];
var logboek  = [];
var databank = [];
var scholenRij = [];     // de scholen zelf, voor de modules
var mensen   = [];       // alle accounts, over alle scholen heen
var feedback = [];       // wat de scholen ons hebben laten weten

/* Waar de accountslijst op dit moment op staat. Dit blijft staan terwijl
   je in een blad iets aanpast: heb je net op "leerkracht van De Regenboog"
   gefilterd en zet je er een rol om, dan sta je daarna weer in diezelfde
   lijst en niet bovenaan bij alles. */
var zoek        = '';
var filterSchool = '';   // '' = alle, 'geen' = zonder school, anders een school-id
var filterRol    = '';   // '' = alle

function haalAlles(){
  return Promise.all([
    SB.roep('schoolcijfers', {}),
    SB.lees('scholen', { kies:'id,naam,modules,huisstijl' }),
    SB.roep('databankcijfers', {}),
    SB.lees('ondersteuning', { kies:'*', volgorde:'tot.desc', hoeveel:50 }),
    SB.lees('handelingen',   { kies:'*', volgorde:'tijd.desc', hoeveel:40 }),
    SB.lees('profielen', { kies:'id,naam,rol,school_id,gebruikersnaam,email,aangemaakt',
                           volgorde:'naam' }),
    SB.lees('feedback', { kies:'*', volgorde:'tijd.desc', hoeveel:300 })
  ]).then(function (uit) {
    cijfers  = uit[0] || [];
    scholenRij = uit[1] || [];
    databank = uit[2] || [];
    deuren   = uit[3] || [];
    logboek  = uit[4] || [];
    mensen   = uit[5] || [];
    feedback = uit[6] || [];
  });
}

function omvang(bytes){
  if (!bytes) return 'geen foto';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' kB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function deurVan(schoolId){
  var nu = Date.now();
  for (var i = 0; i < deuren.length; i++) {
    var d = deuren[i];
    if (d.school_id !== schoolId || d.ingetrokken) continue;
    if (new Date(d.tot).getTime() > nu) return d;
  }
  return null;
}

/* ── het scherm ───────────────────────────────────────────────── */

function tekenMenu(){
  var vak = leeg($('zij-menu'));
  ONDERDELEN.forEach(function (o) {
    var b = el('button', 'zij-knop' + (o.id === huidig ? ' aan' : ''));
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '17'); svg.setAttribute('height', '17');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    var pad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pad.setAttribute('d', o.icoon);
    svg.appendChild(pad);
    b.appendChild(svg);
    b.appendChild(el('span', null, o.naam));
    b.addEventListener('click', function () {
      /* Weg uit het meekijken is stoppen met meekijken. Een balk die
         blijft staan terwijl je ergens anders kijkt, liegt. */
      if (meekijkSchool) { meekijkSchool = null; meekijkGroep = null; meekijkBord = null; }
      huidig = o.id; tekenMenu(); teken();
      /* Opnieuw ophalen, want de cijfers veranderen buiten dit scherm om:
         een school kopieert een hoek, een beheerder zet de deur open. */
      haalAlles().then(teken, function () {});
    });
    vak.appendChild(b);
  });
}

function teken(){
  meekijkBalk();
  var v = leeg($('inhoud'));
  if (huidig === 'meekijken') return tekenMeekijken(v);
  if (huidig === 'accounts')  return tekenAccounts(v);
  if (huidig === 'feedback')  return tekenFeedback(v);
  if (huidig === 'logboek')   return tekenLogboek(v);
  if (huidig === 'databank')  return tekenDatabank(v);
  return tekenScholen(v);
}

/* De balk die niet weg te klikken is. Dit is de belangrijkste regel van
   het hele meekijken: zonder die balk denk je op een avond dat je in je
   eigen bord zit, en dat is precies hoe iemand per ongeluk iets doet bij
   een school die daar niet om heeft gevraagd. */
function meekijkBalk(){
  var oud = $('meekijkbalk');
  if (!meekijkSchool || !meekijkGroep) {
    if (oud) oud.remove();
    document.body.classList.remove('metbalk');
    return;
  }
  if (oud) oud.remove();
  var bar = el('div', null);
  bar.id = 'meekijkbalk';
  var t = el('b', null, 'Je kijkt mee');
  bar.appendChild(t);
  bar.appendChild(el('span', null,
    'bij ' + meekijkGroep.naam + ' van ' + meekijkSchool.naam));
  var stop = document.createElement('button');
  stop.type = 'button';
  stop.textContent = 'Stoppen';
  stop.addEventListener('click', stopMeekijken);
  bar.appendChild(stop);
  document.body.appendChild(bar);
  document.body.classList.add('metbalk');
}

/* ── de hoeken-databank ───────────────────────────────────────────────
   Wat hier staat ziet elke school. Een leerkracht kopieert eruit naar
   haar eigen groep; die kopie is daarna van haar en verandert niet mee
   als jij hier iets aanpast. Dat is met opzet -- anders verandert het
   bord in een klas doordat iemand anders iets bijwerkt. */

function tekenDatabank(v){
  var totaal = databank.reduce(function (n, h) { return n + (Number(h.bytes) || 0); }, 0);
  v.appendChild(kopregel('Hoeken-databank',
    databank.length ? databank.length + ' hoeken \u00b7 ' + omvang(totaal) + ' aan foto\u2019s'
                    : 'Nog leeg',
    [knop('Hoek toevoegen', 'primair', function () { bewerkHoek(null); })]));

  if (!databank.length) {
    var leegvak = el('div', 'leegvak');
    leegvak.appendChild(el('p', 'hint',
      'Hier zet je de hoeken die elke school ziet. Een school die vandaag ' +
      'begint heeft dan meteen iets om uit te kiezen, in plaats van een ' +
      'leeg scherm en twintig plaatjes om zelf te zoeken.'));
    v.appendChild(leegvak);
    return;
  }

  var perCategorie = {};
  databank.forEach(function (h) {
    var c = h.categorie || 'Zonder categorie';
    (perCategorie[c] = perCategorie[c] || []).push(h);
  });

  Object.keys(perCategorie).sort().forEach(function (c) {
    var p = el('div', 'paneel');
    p.appendChild(el('div', 'paneelkop', c));
    perCategorie[c].forEach(function (h) {
      var rij = el('div', 'logrij');
      var links = el('div');
      links.appendChild(el('div', 'logwat', h.naam));
      links.appendChild(el('div', 'rij-sub',
        h.max_kinderen + ' plekken \u00b7 ' + omvang(Number(h.bytes)) + ' \u00b7 ' +
        (h.groepen ? h.groepen + ' keer gekopieerd door ' + h.scholen +
                     (h.scholen === 1 ? ' school' : ' scholen')
                   : 'nog niet gebruikt')));
      rij.appendChild(links);
      var acties = el('div', 'knoprij');
      acties.appendChild(knop('Bewerk', 'stil', function () { bewerkHoek(h); }));
      acties.appendChild(knop('Weg', 'stil', function () { verwijderHoek(h); }));
      rij.appendChild(acties);
      p.appendChild(rij);
    });
    v.appendChild(p);
  });
}

/* Een hoek erbij of eentje aanpassen. De foto gaat naar de map 'basis',
   die elke school mag lezen en die alleen jij mag vullen. */
function bewerkHoek(h){
  var concept = { naam:h ? h.naam : '', categorie:h ? h.categorie : '',
                  max:h ? h.max_kinderen : 4, bestand:null };
  toonBlad(function (blad) {
    var t = el('div', null, h ? 'Hoek aanpassen' : 'Hoek toevoegen');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Naam'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.placeholder = 'Bouwhoek'; naam.value = concept.naam;
    naam.id = 'hoeknaam';
    r1.appendChild(naam); blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'Categorie'));
    var cat = el('input', 'invoer');
    cat.type = 'text'; cat.placeholder = 'Altijd, Winter, Sinterklaas\u2026';
    cat.value = concept.categorie; cat.id = 'hoekcategorie';
    r2.appendChild(cat); blad.appendChild(r2);

    var r3 = el('div', 'veldrij');
    r3.appendChild(el('label', 'veldlabel', 'Hoeveel kinderen tegelijk'));
    var max = el('input', 'invoer');
    max.type = 'number'; max.min = '1'; max.max = '30'; max.value = String(concept.max);
    max.id = 'hoekplekken';
    r3.appendChild(max); blad.appendChild(r3);

    var r4 = el('div', 'veldrij');
    r4.appendChild(el('label', 'veldlabel', h && h.foto_pad ? 'Andere foto kiezen' : 'Foto'));
    var bestand = el('input', 'invoer');
    bestand.type = 'file'; bestand.accept = 'image/*';
    bestand.id = 'hoekfoto';
    r4.appendChild(bestand); blad.appendChild(r4);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Bewaren', 'primair', function () {
      var n = (naam.value || '').trim();
      if (!n) { meld('Geef de hoek een naam'); return; }
      bewaarHoek(h, { naam:n, categorie:(cat.value || '').trim(),
                      max:Math.max(1, Math.min(30, Number(max.value) || 4)),
                      bestand:bestand.files && bestand.files[0] });
    }));
    blad.appendChild(rij);
    zetCursor(naam, blad);
  });
}

function bewaarHoek(h, g){
  var rij = { naam:g.naam, categorie:g.categorie, max_kinderen:g.max,
              school_id:null, groep_id:null };

  var metFoto = !g.bestand ? Promise.resolve(null) : (function () {
    var punt = (g.bestand.name || '').lastIndexOf('.');
    var ext  = punt > 0 ? g.bestand.name.slice(punt + 1).toLowerCase() : 'png';
    var pad  = 'basis/' + (crypto.randomUUID ? crypto.randomUUID()
                                             : String(Date.now())) + '.' + ext;
    return SB.bestandOp(pad, g.bestand).then(function () {
      return SB.schrijf('media', [{ school_id:null, groep_id:null, soort:'hoek',
                                    naam:g.naam, pad:pad, bytes:g.bestand.size }]);
    }).then(function () { return pad; });
  })();

  metFoto.then(function (pad) {
    if (pad) rij.foto_pad = pad;
    return h ? SB.wijzig('hoeken', rij, { id:'eq.' + h.id })
             : SB.schrijf('hoeken', [rij]);
  }).then(function () {
    sluitBlad();
    return haalAlles().then(function () { teken(); meld(h ? 'Aangepast' : 'Toegevoegd'); });
  }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
}

function verwijderHoek(h){
  toonBlad(function (blad) {
    var t = el('div', null, h.naam + ' weghalen?');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint', h.groepen
      ? 'Deze hoek is ' + h.groepen + ' keer gekopieerd. Die kopieën blijven ' +
        'gewoon staan — een groep die hem gebruikt merkt hier niets van.'
      : 'Deze hoek is nog niet gekopieerd.'));
    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Weghalen', 'gevaar', function () {
      SB.wis('hoeken', { id:'eq.' + h.id }).then(function () {
        return h.foto_pad ? SB.bestandWeg(h.foto_pad).catch(function () {}) : null;
      }).then(function () {
        return h.foto_pad ? SB.wis('media', { pad:'eq.' + h.foto_pad }).catch(function () {}) : null;
      }).then(function () {
        sluitBlad();
        return haalAlles().then(function () { teken(); meld('Weggehaald'); });
      }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    blad.appendChild(rij);
  });
}

function tekenScholen(v){
  v.appendChild(kopregel(
    'Scholen', cijfers.length === 1 ? 'Eén school' : cijfers.length + ' scholen',
    [knop('Voorbeeldschool', 'stil', toonVoorbeeld),
     knop('Nieuwe school', 'primair', toonNieuweSchool)]));

  if (!cijfers.length) {
    var leegvak = el('div', 'leegvak');
    leegvak.appendChild(el('p', 'hint',
      'Er staat nog geen school. Maak er een aan, of zet een voorbeeldschool ' +
      'met verzonnen kinderen neer om te laten zien hoe het werkt.'));
    v.appendChild(leegvak);
    return;
  }

  var rooster = el('div', 'scholen');
  cijfers.forEach(function (c) {
    var kaart = el('div', 'schoolkaart');
    kaart.appendChild(el('div', 'schoolnaam', c.naam));

    /* Een school zonder schoolbeheerder staat stil zodra er iets moet:
       er is dan niemand die collega's kan toevoegen of groepen kan
       regelen. Dat is precies het soort ding dat niemand opmerkt tot het
       te laat is, dus het staat op de kaart. */
    var heeftBeheerder = mensen.some(function (m) {
      return m.school_id === c.school_id && m.rol === 'schoolbeheerder';
    });
    if (!heeftBeheerder) {
      var zonder = el('div', 'deur geenbeheer', 'Geen schoolbeheerder');
      zonder.title = 'Er is hier niemand die collega\u2019s kan toevoegen of groepen kan regelen.';
      kaart.appendChild(zonder);
    }

    var deur = deurVan(c.school_id);
    if (deur) {
      kaart.appendChild(el('div', 'deur',
        'Deur open tot ' + datum(deur.tot) + (deur.reden ? ' \u2014 ' + deur.reden : '')));
    }

    var vak = el('div', 'cijfers');
    [[c.leerkrachten, 'leerkrachten'], [c.groepen, 'groepen'],
     [c.leerlingen, 'kinderen'], [c.hoeken, 'hoeken']].forEach(function (paar) {
      var k = el('div', 'cijfer');
      k.appendChild(el('b', null, String(paar[0])));
      k.appendChild(el('span', null, paar[1]));
      vak.appendChild(k);
    });
    kaart.appendChild(vak);

    kaart.appendChild(el('div', 'stil', c.laatst_gebruikt
      ? 'Laatst gebruikt ' + datum(c.laatst_gebruikt)
      : 'Nog niet gebruikt'));
    /* Meekijken kan alleen zolang de school de deur openzet. Staat hij
       dicht, dan staat er geen grijze knop die niets doet -- dan staat
       er niets, want er valt niets te kiezen. */
    /* Welke onderdelen deze school heeft. Nu alleen het planbord; het
       keuzebord zit er altijd in, dat is wat ze kopen. */
    var rij0 = scholenRij.filter(function (s) { return s.id === c.school_id; })[0];
    var mods = (rij0 && rij0.modules) || {};
    var modrij = el('div', 'knoprij');
    var aan = mods.planbord === true;
    var mk2 = el('button', 'chip' + (aan ? ' aan' : ''), 'Planbord');
    mk2.title = aan ? 'Deze school heeft het planbord' : 'Deze school heeft alleen het keuzebord';
    mk2.addEventListener('click', function () {
      var nieuw = Object.assign({}, mods, { planbord: !aan });
      // het logboek van de school schrijft de database zelf (school_bewaken)
      SB.wijzig('scholen', { modules: nieuw }, { id:'eq.' + c.school_id })
        .then(function () { return haalAlles(); })
        .then(function () { teken(); meld(!aan ? 'Planbord aan' : 'Planbord uit'); },
              function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    });
    modrij.appendChild(mk2);
    kaart.appendChild(modrij);

    var acties = el('div', 'knoprij');
    if (deur) acties.appendChild(knop('Meekijken', 'stil', function () { kiesGroep(c, deur); }));
    acties.appendChild(knop('Accounts', 'stil', function () {
      filterSchool = c.school_id; filterRol = ''; zoek = '';
      huidig = 'accounts'; tekenMenu(); teken();
    }));
    acties.appendChild(knop('Hernoemen', 'stil', function () { toonSchoolAanpassen(c); }));
    var op = knop('Opheffen', 'stil', function () { verwijderSchool(c); });
    op.classList.add('weg');
    acties.appendChild(op);
    kaart.appendChild(acties);
    rooster.appendChild(kaart);
  });
  v.appendChild(rooster);

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Waarom hier geen kinderen staan'));
  uitleg.appendChild(el('p', 'hint',
    'Je ziet hier aantallen en verder niets. De kinderen, de borden en de ' +
    'statistieken zijn van de school, niet van wie de software levert. ' +
    'Moet je een school helpen, dan zet de schoolbeheerder de deur zelf ' +
    'open; dat loopt na een paar uur vanzelf af en komt in het logboek ' +
    'dat de school kan nakijken.'));
  v.appendChild(uitleg);
}

function tekenLogboek(v){
  v.appendChild(kopregel('Logboek', 'Wie heeft wat gedaan'));
  var p = el('div', 'paneel');
  if (!logboek.length) {
    p.appendChild(el('p', 'hint', 'Nog niets gebeurd.'));
  } else {
    logboek.forEach(function (r) {
      var rij = el('div', 'logrij');
      rij.appendChild(el('div', 'logwat', r.wat + (r.waarover ? ' — ' + r.waarover : '')));
      rij.appendChild(el('div', 'logtijd', datum(r.tijd)));
      p.appendChild(rij);
    });
  }
  v.appendChild(p);

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Alleen bijschrijven'));
  uitleg.appendChild(el('p', 'hint',
    'Deze regels zijn door niemand te wijzigen of te wissen, ook niet door ' +
    'jou. Dat is het punt: een logboek dat de beheerder kan bijwerken is ' +
    'geen logboek. Een school ziet hier haar eigen regels terug.'));
  v.appendChild(uitleg);
}

/* ── meekijken ────────────────────────────────────────────────────────
   Alleen zolang de school de deur openzet, en alleen kijken: bedienen
   komt later en vraagt eerst een antwoord op de botsing met een bord
   dat offline doorwerkt. Zie DECISIONS.md.

   Twee dingen zijn hier verplicht. Een balk die niet weg te klikken is,
   want zonder dat denk je op een avond dat je in je eigen bord zit. En
   een regel in het logboek, ook voor alleen maar kijken -- dat is wat
   een school van je mag verwachten als ze vragen wie er in hun gegevens
   heeft gekeken. */

var meekijkSchool = null;   // { school_id, naam }
var meekijkGroep  = null;   // { id, naam }
var meekijkBord   = null;   // wat we van de server haalden

function kiesGroep(school, deur){
  SB.lees('groepen', { kies:'id,naam,volgorde', waar:{ school_id:'eq.' + school.school_id },
                       volgorde:'volgorde' })
    .then(function (groepen) {
      toonBlad(function (blad) {
        var t = el('div', null, 'Meekijken bij ' + school.naam);
        t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
        blad.appendChild(t);
        blad.appendChild(el('p', 'hint',
          'De school heeft de deur opengezet tot ' + datum(deur.tot) +
          (deur.reden ? ' \u2014 ' + deur.reden : '') +
          '. Wat je opent komt in hun logboek te staan.'));

        if (!groepen || !groepen.length) {
          blad.appendChild(el('p', 'hint', 'Deze school heeft nog geen groepen.'));
        } else {
          groepen.forEach(function (g) {
            var rij = el('div', 'logrij');
            rij.appendChild(el('div', 'logwat', g.naam));
            var acties = el('div', 'knoprij');
            acties.appendChild(knop('Openen', 'stil', function () {
              sluitBlad();
              openMeekijken(school, g);
            }));
            rij.appendChild(acties);
            blad.appendChild(rij);
          });
        }
        var rij = el('div', 'knoprij-onder');
        rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
        blad.appendChild(rij);
      });
    }, function (e) { meld('De groepen laden lukte niet: ' + (e && e.message)); });
}

function openMeekijken(school, groep){
  meekijkSchool = school;
  meekijkGroep = groep;
  huidig = 'meekijken';
  tekenMenu();
  meld('Bezig met ophalen\u2026');

  /* Eerst vastleggen dát je kijkt, en pas daarna kijken. Andersom zou
     een mislukte ophaalronde een bezoek onzichtbaar maken. */
  SB.roep('noteer', { wat:'meegekeken', school: school.school_id,
                      waarover: groep.naam })
    .catch(function () {})
    .then(function () { return haalMeekijkBord(groep.id); })
    .then(function () { teken(); }, function (e) {
      meekijkBord = { fout: (e && e.message) || 'onbekend' };
      teken();
    });
}

function haalMeekijkBord(groepId){
  return Promise.all([
    SB.lees('borden',     { kies:'*', waar:{ groep_id:'eq.' + groepId }, volgorde:'volgorde' }),
    SB.lees('hoeken',     { kies:'*', waar:{ groep_id:'eq.' + groepId }, volgorde:'volgorde' }),
    SB.lees('leerlingen', { kies:'*', waar:{ groep_id:'eq.' + groepId }, volgorde:'volgorde' })
  ]).then(function (uit) {
    var borden = uit[0] || [];
    var bord = borden.filter(function (b) { return b.actief; })[0] || borden[0];
    if (!bord) { meekijkBord = { leeg:true }; return; }
    return Promise.all([
      SB.lees('bord_hoeken', { kies:'*', waar:{ bord_id:'eq.' + bord.id }, volgorde:'volgorde' }),
      SB.lees('plaatsingen', { kies:'*', waar:{ bord_id:'eq.' + bord.id } })
    ]).then(function (uit2) {
      meekijkBord = { bord: bord, hoeken: uit[1], leerlingen: uit[2],
                      opBord: uit2[0] || [], plaatsingen: uit2[1] || [] };
    });
  });
}

function stopMeekijken(){
  meekijkSchool = null; meekijkGroep = null; meekijkBord = null;
  huidig = 'scholen';
  tekenMenu();
  haalAlles().then(teken, teken);
}

function tekenMeekijken(v){
  var school = meekijkSchool, groep = meekijkGroep;
  if (!school || !groep) { huidig = 'scholen'; tekenMenu(); return teken(); }

  v.appendChild(kopregel('Meekijken', groep.naam + ' van ' + school.naam,
    knop('Stoppen', 'stil', stopMeekijken)));

  if (!meekijkBord) {
    var bezig = el('div', 'paneel');
    bezig.appendChild(el('p', 'hint', 'Bezig met ophalen\u2026'));
    v.appendChild(bezig);
    return;
  }
  if (meekijkBord.fout) {
    var fout = el('div', 'paneel');
    fout.appendChild(el('p', 'hint',
      'Dat lukte niet: ' + meekijkBord.fout + '. Staat de deur nog open?'));
    v.appendChild(fout);
    return;
  }
  if (meekijkBord.leeg || !meekijkBord.hoeken.length) {
    var leegvak = el('div', 'leegvak');
    leegvak.appendChild(el('p', 'hint', 'Deze groep heeft nog geen bord met hoeken.'));
    v.appendChild(leegvak);
    return;
  }

  var opNaam = {};
  meekijkBord.leerlingen.forEach(function (l) { opNaam[l.id] = l.naam; });
  var perHoek = {};
  meekijkBord.plaatsingen.forEach(function (pl) {
    (perHoek[pl.hoek_id] = perHoek[pl.hoek_id] || []).push(opNaam[pl.leerling_id] || '?');
  });
  var opBord = {};
  meekijkBord.opBord.forEach(function (r, i) { opBord[r.hoek_id] = i; });

  var p = el('div', 'paneel');
  p.appendChild(el('div', 'paneelkop', 'Wie staat waar'));
  meekijkBord.hoeken
    .filter(function (h) { return opBord[h.id] !== undefined; })
    .sort(function (a, b) { return opBord[a.id] - opBord[b.id]; })
    .forEach(function (h) {
      var erin = perHoek[h.id] || [];
      var rij = el('div', 'logrij');
      var links = el('div');
      links.appendChild(el('div', 'logwat', h.naam));
      links.appendChild(el('div', 'rij-sub', erin.length ? erin.join(', ') : 'nog niemand'));
      rij.appendChild(links);
      rij.appendChild(el('div', 'logtijd', erin.length + '/' + (h.max_kinderen || 4)));
      p.appendChild(rij);
    });
  v.appendChild(p);

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Je kijkt alleen'));
  uitleg.appendChild(el('p', 'hint',
    'Bedienen zit hier nog niet in. Dat vraagt eerst een antwoord op wat er ' +
    'gebeurt als jij hier een kind verplaatst terwijl het bord in de klas ' +
    'offline hetzelfde kind al heeft verplaatst \u2014 daar wint het digibord, ' +
    'want daar staat het kind echt. Tot die tijd kijk je en bel je.'));
  uitleg.appendChild(el('p', 'hint',
    'Dat je deze groep hebt geopend staat in het logboek van de school.'));
  v.appendChild(uitleg);
}

/* ── een school erbij ───────────────────────────────────────────
   Eén venster: naam van de school, naam van de schoolbeheerder, en
   er rolt een kaartje uit. Zij kan daarmee meteen inloggen.

   Hiervoor vulde je hier een e-mailadres in en kreeg je een code om
   door te geven; die persoon moest zich dan zelf aanmelden en de code
   intikken. Drie stappen waarin iets mis kon gaan voordat iemand ook
   maar iets had gezien. Nu is het één stap, en wat je doorgeeft is een
   kaartje in plaats van een procedure. */

function toonNieuweSchool(){
  var concept = { naam:'', beheerder:'', gebruikersnaam:'', zelfGekozen:false };
  toonBlad(function (blad) {
    var t = el('div', null, 'Nieuwe school');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'De school krijgt meteen een schoolbeheerder met een eigen account. ' +
      'Zonder beheerder is het een school waar niemand bij kan.'));

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Naam van de school'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.placeholder = 'Kindcentrum De Regenboog';
    naam.value = concept.naam;
    naam.addEventListener('input', function () { concept.naam = naam.value; });
    r1.appendChild(naam);
    blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'Naam van de schoolbeheerder'));
    var pers = el('input', 'invoer');
    pers.type = 'text'; pers.placeholder = 'Marloes de Vries';
    pers.value = concept.beheerder;
    r2.appendChild(pers);
    blad.appendChild(r2);

    var r3 = el('div', 'veldrij');
    r3.appendChild(el('label', 'veldlabel', 'Gebruikersnaam'));
    var gn = el('input', 'invoer');
    gn.type = 'text'; gn.placeholder = 'marloes.devries';
    gn.autocapitalize = 'off'; gn.spellcheck = false;
    gn.value = concept.gebruikersnaam;
    r3.appendChild(gn);
    var stand = el('div', 'hint');
    stand.style.marginTop = '4px';
    r3.appendChild(stand);
    blad.appendChild(r3);

    /* Vóór het aanmaken kijken of de naam vrij is. Komt dat er pas bij
       het opslaan uit, dan bestaat de school al en de beheerder niet --
       en dan staat er een school zonder iemand die erbij kan. */
    var kijker = null;
    function kijkNaam(){
      var n = concept.gebruikersnaam;
      clearTimeout(kijker);
      stand.style.color = '';
      if (!n) { stand.textContent = ''; return; }
      stand.textContent = 'Even kijken\u2026';
      kijker = setTimeout(function () {
        SB.roep('gebruikersnaam_vrij', { gewenst: n }).then(function (vrij) {
          stand.textContent = vrij ? 'Vrij.' : 'Die naam is al in gebruik. Kies een andere.';
          stand.style.color = vrij ? '' : 'var(--stop)';
        }, function () { stand.textContent = ''; });
      }, 350);
    }

    pers.addEventListener('input', function () {
      concept.beheerder = pers.value;
      if (!concept.zelfGekozen) {
        gn.value = SB.gebruikersnaamNet(pers.value);
        concept.gebruikersnaam = gn.value;
        kijkNaam();
      }
    });
    gn.addEventListener('input', function () {
      concept.zelfGekozen = true;
      gn.value = SB.gebruikersnaamNet(gn.value);
      concept.gebruikersnaam = gn.value;
      kijkNaam();
    });

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    var maak = knop('Aanmaken', 'primair', function () {
      var n = (concept.naam || '').trim();
      var persoon = (concept.beheerder || '').trim();
      var gebruiker = SB.gebruikersnaamNet(concept.gebruikersnaam);
      if (!n) { meld('Geef de school een naam'); naam.focus(); return; }
      if (!persoon) { meld('Vul de naam van de schoolbeheerder in'); pers.focus(); return; }
      if (!gebruiker) { meld('Vul een gebruikersnaam in'); gn.focus(); return; }

      var ww;
      try { ww = KBKAARTJE.wachtwoord(); }
      catch (e) { meld('Deze browser kan geen veilig wachtwoord maken. Probeer een andere.'); return; }

      maak.disabled = true;
      maak.textContent = 'Bezig\u2026';

      /* De school eerst: die zet meteen een uitnodiging klaar op het
         interne adres, met de rol schoolbeheerder erbij. Daarna het
         account, en dan koppelt de trekker in de database de twee. */
      SB.roep('school_aanmaken', { schoolnaam: n, beheerder_email: SB.inlogadres(gebruiker) })
        .then(function () { return SB.maakAccountVoor(gebruiker, ww, persoon); })
        .then(function () { return haalAlles(); })
        .then(function () {
          sluitBlad(); teken();
          toonKaartje({ naam: persoon, gebruikersnaam: gebruiker, wachtwoord: ww,
                        rol: 'schoolbeheerder', school: n });
        }, function (err) {
          maak.disabled = false;
          maak.textContent = 'Aanmaken';
          meld(SB.isTeVaak(err)
            ? 'Supabase laat maar dertig aanmeldingen per vijf minuten toe vanaf \u00e9\u00e9n plek. Wacht vijf minuten en ga dan verder \u2014 er is niets misgegaan.'
            : 'Dat lukte niet: ' + (err && err.message));
        });
    });
    rij.appendChild(maak);
    blad.appendChild(rij);
    zetCursor(naam, blad);
  });
}

/* Het kaartje komt uit src/kb-kaartje.js, zodat het schoolbeheer en het
   platformbeheer er één versie van delen. */
function toonKaartje(gegevens){
  toonBlad(function (blad) {
    var kop = el('div', 'nietprinten');
    var t = el('div', null, 'De school staat klaar');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    kop.appendChild(t);
    kop.appendChild(el('p', 'hint',
      'Print dit kaartje of schrijf het over, en geef het aan ' + gegevens.naam + '. ' +
      'Het wachtwoord staat hierna nergens meer \u2014 ook jij kunt het niet opzoeken. ' +
      'Raakt zij het kwijt, dan maak je een nieuw.'));
    blad.appendChild(kop);

    blad.appendChild(KBKAARTJE.bouw(gegevens));

    var rij = el('div', 'knoprij-onder nietprinten');
    rij.appendChild(knop('Printen', 'primair', function () { window.print(); }));
    rij.appendChild(knop('Kopi\u00ebren', 'stil', function () {
      KBKAARTJE.kopieer(gegevens).then(
        function () { meld('Gekopieerd'); },
        function () { meld('Kopi\u00ebren lukte niet \u2014 schrijf het over'); });
    }));
    rij.appendChild(knop('Klaar', 'stil', sluitBlad));
    blad.appendChild(rij);
  });
}

/* Vroeger stond hier een eigen lijstje met de accounts van één school.
   Dat is weg: er is nu één lijst over alle scholen heen, en de knop op
   de schoolkaart zet daar het filter op. Twee lijsten met dezelfde
   mensen erin lopen vroeg of laat uit elkaar. */

function nieuwWachtwoord(mens, schoolnaam){
  var wie = mens.naam || mens.gebruikersnaam;
  toonBlad(function (blad) {
    var t = el('div', null, 'Nieuw wachtwoord voor ' + wie + '?');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Het oude wachtwoord werkt daarna niet meer. Je krijgt een kaartje om uit te ' +
      'printen; daarna kan niemand het meer opzoeken, ook jij niet.'));
    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Nieuw wachtwoord', 'primair', function () {
      var ww;
      try { ww = KBKAARTJE.wachtwoord(); }
      catch (e) { meld('Deze browser kan geen veilig wachtwoord maken.'); return; }
      SB.roep('wachtwoord_zetten', { wie: mens.id, nieuw: ww }).then(function () {
        toonKaartje({ naam: wie, gebruikersnaam: mens.gebruikersnaam || '',
                      wachtwoord: ww, rol: mens.rol, school: schoolnaam });
      }, function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    blad.appendChild(rij);
  });
}

/* ── wat de scholen ons laten weten ───────────────────────────────────
   Alle meldingen uit de app, met een stand erbij zodat je ziet wat je
   nog moet doen. Dit is het enige scherm waar ze te lezen zijn: de
   notitie is van jou, en een melding kan over een collega gaan.

   Niet verwijderen maar afhandelen. Een melding die weg is, is een
   melding waarvan je over een half jaar niet meer weet dat hij er is
   geweest -- en dan komt hij een tweede keer binnen en begin je opnieuw. */

var STANDEN = [['nieuw','Nieuw'], ['opgepakt','Opgepakt'],
               ['afgehandeld','Afgehandeld'], ['afgewezen','Afgewezen']];
var SOORTWOORD = { probleem:'Er klopt iets niet', vraag:'Ik snap iets niet',
                   idee:'Een idee', compliment:'Compliment' };
var filterStand = 'open';   // 'open' = nieuw + opgepakt, '' = alles
var filterSoort = '';
var csvAdres = null;

function standWoord(stand){
  for (var i = 0; i < STANDEN.length; i++) if (STANDEN[i][0] === stand) return STANDEN[i][1];
  return stand;
}

function meldingenNu(){
  return feedback.filter(function (f) {
    if (filterStand === 'open' && f.stand !== 'nieuw' && f.stand !== 'opgepakt') return false;
    if (filterStand && filterStand !== 'open' && f.stand !== filterStand) return false;
    if (filterSoort && f.soort !== filterSoort) return false;
    return true;
  });
}

function naamVan(id){
  for (var i = 0; i < mensen.length; i++) {
    if (mensen[i].id === id) return mensen[i].naam || mensen[i].gebruikersnaam || '—';
  }
  return 'account is weg';
}

/* Eén veld voor een csv-bestand.

   Die apostrof vooraan is geen sierlijkheid. Begint een veld met = + -
   of @, dan ziet Excel er een formule in en voert die uit zodra je het
   bestand opent. De tekst in een melding typt iemand anders in; dat is
   precies het soort veld waar je dat niet wilt. */
function csvVeld(waarde){
  var t = String(waarde == null ? '' : waarde);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}

function csvMaken(rijen){
  var kop = ['tijd','stand','soort','school','van','scherm','uitgave',
             'apparaat','tekst','contact','notitie'];
  var regels = [kop.map(csvVeld).join(';')];
  rijen.forEach(function (f) {
    regels.push([
      f.tijd, standWoord(f.stand), SOORTWOORD[f.soort] || f.soort,
      f.school_id ? schoolnaamVan(f.school_id) : 'geen school',
      naamVan(f.wie), f.scherm, f.versie, f.apparaat,
      f.tekst, f.contact, f.notitie
    ].map(csvVeld).join(';'));
  });
  /* De bom vooraan is voor Excel: zonder dat leest het de tekst als
     latin-1 en wordt elke é een Ã©. Puntkomma's en geen komma's om
     dezelfde reden -- een Nederlandse Excel splitst daarop. */
  return '﻿' + regels.join('\r\n') + '\r\n';
}

function tekenFeedback(v){
  var open = feedback.filter(function (f) {
    return f.stand === 'nieuw' || f.stand === 'opgepakt'; }).length;

  /* Uitvoeren is een link en geen knop: een knop die een bestand
     binnenhaalt verandert niets aan het scherm, en dan is hij niet te
     onderscheiden van een knop die stuk is. */
  var uit = el('a', 'knop knop-stil knop-klein', 'Uitvoeren als csv');
  uit.id = 'csv-uitvoeren';
  uit.download = 'feedback.csv';

  v.appendChild(kopregel('Feedback',
    feedback.length
      ? (open === 1 ? 'Eén melding open' : open + ' meldingen open') +
        ' · ' + feedback.length + ' in totaal'
      : 'Nog geen meldingen',
    [uit]));

  var rij1 = el('div', 'chips');
  [['open','Nog te doen'], ['','Alles']].concat(STANDEN).forEach(function (paar) {
    var c = el('button', 'chip' + (filterStand === paar[0] ? ' aan' : ''), paar[1]);
    c.addEventListener('click', function () { filterStand = paar[0]; teken(); });
    rij1.appendChild(c);
  });
  v.appendChild(rij1);

  var rij2 = el('div', 'chips');
  [['','Alle soorten']].concat(Object.keys(SOORTWOORD).map(function (k) {
    return [k, SOORTWOORD[k]];
  })).forEach(function (paar) {
    var c = el('button', 'chip' + (filterSoort === paar[0] ? ' aan' : ''), paar[1]);
    c.addEventListener('click', function () { filterSoort = paar[0]; teken(); });
    rij2.appendChild(c);
  });
  v.appendChild(rij2);

  var nu = meldingenNu();

  /* Het adres van het csv-bestand hangt aan wat er nu op het scherm
     staat: wat je uitvoert is wat je ziet. Het oude adres gaat eruit,
     anders houdt de browser elk bestand van deze sessie vast. */
  if (csvAdres) { try { URL.revokeObjectURL(csvAdres); } catch (e) {} }
  csvAdres = URL.createObjectURL(new Blob([csvMaken(nu)], { type:'text/csv;charset=utf-8' }));
  uit.href = csvAdres;
  if (!nu.length) uit.classList.add('uit');

  var vak = el('div', 'paneel');
  if (!nu.length) {
    vak.appendChild(el('p', 'hint', feedback.length
      ? 'Geen melding die hierop past.'
      : 'Er is nog niets binnengekomen. De knop staat in de zijbalk van het ' +
        'beheer en in het menu van het bord.'));
  } else {
    nu.forEach(function (f) { vak.appendChild(meldingKaart(f)); });
  }
  v.appendChild(vak);

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Wat er meekomt en wat niet'));
  uitleg.appendChild(el('p', 'hint',
    'Scherm, uitgave en apparaat gaan vanzelf mee, en de app zegt er in het ' +
    'meldingsscherm ook bij dat dat gebeurt. Er komt geen schermafdruk mee ' +
    'en niets van de kinderen. Staat er toch een kindernaam in een melding, ' +
    'dan heeft iemand hem zelf ingetypt — haal hem er dan uit met de notitie ' +
    'en handel de melding af.'));
  v.appendChild(uitleg);
}

function meldingKaart(f){
  var k = el('div', 'melding-kaart');

  var kop = el('div', 'melding-kop');
  kop.appendChild(el('span', 'rolmerk' + (f.soort === 'probleem' ? ' platform' :
                                          f.soort === 'compliment' ? ' beheer' : ''),
                     SOORTWOORD[f.soort] || f.soort));
  kop.appendChild(el('span', 'melding-stand stand-' + f.stand, standWoord(f.stand)));
  kop.appendChild(el('span', 'melding-tijd', datum(f.tijd)));
  k.appendChild(kop);

  k.appendChild(el('div', 'melding-tekst', f.tekst));

  var onder = el('div', 'melding-onder');
  onder.textContent = naamVan(f.wie) + ' · ' +
    (f.school_id ? schoolnaamVan(f.school_id) : 'geen school') +
    (f.scherm ? ' · ' + f.scherm : '') +
    (f.versie ? ' · ' + f.versie : '') +
    (f.apparaat ? ' · ' + f.apparaat : '');
  k.appendChild(onder);

  if (f.contact) {
    var c = el('div', 'melding-onder');
    c.textContent = 'Terugkoppelen via: ' + f.contact;
    k.appendChild(c);
  }
  if (f.notitie) {
    var n = el('div', 'melding-notitie');
    n.textContent = f.notitie;
    k.appendChild(n);
  }

  var acties = el('div', 'knoprij');
  acties.appendChild(knop('Behandelen', 'stil', function () { toonBehandelen(f); }));
  k.appendChild(acties);
  return k;
}

function toonBehandelen(f){
  var stand = f.stand;
  toonBlad(function (blad) {
    var t = el('div', null, 'Melding behandelen');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);

    var citaat = el('div', 'melding-tekst', f.tekst);
    citaat.style.marginBottom = '4px';
    blad.appendChild(citaat);
    blad.appendChild(el('p', 'hint', naamVan(f.wie) + ' · ' +
      (f.school_id ? schoolnaamVan(f.school_id) : 'geen school') + ' · ' + datum(f.tijd)));

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Stand'));
    var chips = el('div', 'knoprij');
    STANDEN.forEach(function (paar) {
      var c = el('button', 'chip' + (stand === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        stand = paar[0];
        [].forEach.call(chips.children, function (x) { x.classList.remove('aan'); });
        c.classList.add('aan');
      });
      chips.appendChild(c);
    });
    r1.appendChild(chips);
    blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'Notitie voor jezelf'));
    var notitie = el('textarea', 'invoer');
    notitie.id = 'fb-notitie';
    notitie.rows = 3;
    notitie.style.cssText = 'resize:vertical;min-height:72px;line-height:1.5';
    notitie.value = f.notitie || '';
    notitie.placeholder = 'Wat je ermee hebt gedaan, of waarom niet.';
    r2.appendChild(notitie);
    r2.appendChild(el('div', 'hint', 'Alleen jij leest dit. De school ziet het niet.'));
    blad.appendChild(r2);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    var bewaar = knop('Opslaan', 'primair', function () {
      bewaar.disabled = true; bewaar.textContent = 'Bezig…';
      SB.roep('feedback_behandelen', { welke: f.id, nieuwe_stand: stand,
                                       nieuwe_notitie: notitie.value || '' })
        .then(function () { return haalAlles(); })
        .then(function () { sluitBlad(); teken(); meld('Opgeslagen'); },
              function (e) {
                bewaar.disabled = false; bewaar.textContent = 'Opslaan';
                meld((e && e.message) || 'Dat lukte niet');
              });
    });
    rij.appendChild(bewaar);
    blad.appendChild(rij);
  });
}

/* ── alle accounts, op één hoop ───────────────────────────────────────
   Eén lijst over alle scholen heen, met een zoekveld en twee filters.
   Dat is met opzet geen lijstje per school: de vragen die hier binnen
   komen gaan over een mens ("Marieke kan niet inloggen"), en dan wil je
   niet eerst weten bij welke school ze hoort.

   Wat de platformbeheerder hier ziet is een naam, een gebruikersnaam,
   een rol en een school. Geen kinderen, geen borden, geen statistieken
   -- die zijn van de school. Zie docs/ROLLEN.md. */

function schoolnaamVan(id){
  if (!id) return '';
  for (var i = 0; i < scholenRij.length; i++) {
    if (scholenRij[i].id === id) return scholenRij[i].naam;
  }
  return 'onbekende school';
}

var ROLNAAM = { leerkracht:'Leerkracht', schoolbeheerder:'Schoolbeheerder',
                platformbeheerder:'Platformbeheerder' };

function rolMerk(rol){
  var m = el('span', 'rolmerk' + (rol === 'schoolbeheerder' ? ' beheer' :
                                  rol === 'platformbeheerder' ? ' platform' : ''),
             ROLNAAM[rol] || rol);
  return m;
}

/* Wat er na het filteren overblijft. Zoeken gaat over naam en
   gebruikersnaam allebei: je weet van een collega meestal het een of
   het ander, zelden precies welk van de twee in het systeem staat. */
function gefilterd(){
  var z = zoek.trim().toLowerCase();
  return mensen.filter(function (m) {
    if (filterRol && m.rol !== filterRol) return false;
    if (filterSchool === 'geen' && m.school_id) return false;
    if (filterSchool && filterSchool !== 'geen' && m.school_id !== filterSchool) return false;
    if (!z) return true;
    return ((m.naam || '') + ' ' + (m.gebruikersnaam || '') + ' ' +
            schoolnaamVan(m.school_id)).toLowerCase().indexOf(z) >= 0;
  });
}

function tekenAccounts(v){
  v.appendChild(kopregel('Accounts',
    mensen.length === 1 ? 'Eén account' : mensen.length + ' accounts',
    [knop('Account toevoegen', 'primair', function () { toonNieuwAccount(); })]));

  /* De filterbalk. Hij tekent zichzelf niet opnieuw bij elke aanslag --
     dan springt de cursor naar het eind en typ je "Marieke" als
     "ekeiraM". Alleen de lijst eronder wordt opnieuw gevuld. */
  var balk = el('div', 'filterbalk');

  var zoekveld = el('input', 'invoer zoekveld');
  zoekveld.type = 'search';
  zoekveld.placeholder = 'Zoek op naam, gebruikersnaam of school…';
  zoekveld.value = zoek;
  balk.appendChild(zoekveld);

  var kiesSchool = el('select', 'invoer kiesveld');
  function optie(waarde, tekst){
    var o = el('option', null, tekst); o.value = waarde;
    if (waarde === filterSchool) o.selected = true;
    return o;
  }
  kiesSchool.appendChild(optie('', 'Alle scholen'));
  kiesSchool.appendChild(optie('geen', 'Zonder school'));
  scholenRij.slice().sort(function (a, b) { return a.naam.localeCompare(b.naam); })
    .forEach(function (s) { kiesSchool.appendChild(optie(s.id, s.naam)); });
  balk.appendChild(kiesSchool);
  v.appendChild(balk);

  var rolrij = el('div', 'chips');
  [['', 'Alle rollen'], ['leerkracht', 'Leerkrachten'],
   ['schoolbeheerder', 'Schoolbeheerders'], ['platformbeheerder', 'Platformbeheer']]
    .forEach(function (paar) {
      var c = el('button', 'chip' + (filterRol === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () { filterRol = paar[0]; teken(); });
      rolrij.appendChild(c);
    });
  v.appendChild(rolrij);

  var vak = el('div', 'paneel');
  v.appendChild(vak);

  function vulLijst(){
    leeg(vak);
    var nu = gefilterd();
    vak.appendChild(el('div', 'paneelkop',
      nu.length === mensen.length
        ? (nu.length === 1 ? 'Eén account' : 'Alle ' + nu.length + ' accounts')
        : nu.length + ' van ' + mensen.length));
    if (!nu.length) {
      vak.appendChild(el('p', 'hint', 'Geen account dat hierop past.'));
      return;
    }
    nu.forEach(function (m) { vak.appendChild(accountRij(m)); });
  }

  var tikker = null;
  zoekveld.addEventListener('input', function () {
    zoek = zoekveld.value;
    clearTimeout(tikker);
    tikker = setTimeout(vulLijst, 120);
  });
  kiesSchool.addEventListener('change', function () {
    filterSchool = kiesSchool.value; vulLijst();
  });
  vulLijst();

  var uitleg = el('div', 'paneel');
  uitleg.appendChild(el('div', 'paneelkop', 'Wat hier niet staat'));
  uitleg.appendChild(el('p', 'hint',
    'Namen, gebruikersnamen, rollen en scholen — verder niets. Welke kinderen ' +
    'er in een groep zitten en wat er op een bord gebeurt is van de school. ' +
    'Een wachtwoord kun je vervangen maar nooit opzoeken, ook jij niet.'));
  v.appendChild(uitleg);
}

function accountRij(m){
  var r = el('div', 'mensrij');
  var links = el('div', 'menslinks');
  var naam = el('div', 'mensnaam', m.naam || m.gebruikersnaam || '—');
  links.appendChild(naam);
  var onder = [];
  if (m.gebruikersnaam) onder.push(m.gebruikersnaam);
  onder.push(m.school_id ? schoolnaamVan(m.school_id) : 'geen school');
  links.appendChild(el('div', 'mensonder', onder.join(' · ')));
  r.appendChild(links);
  /* De rol in een eigen vakje van vaste breedte, zodat de merkjes een
     kolom vormen in plaats van mee te schuiven met de knoppen ernaast. */
  var rolvak = el('div', 'mensrol');
  rolvak.appendChild(rolMerk(m.rol));
  r.appendChild(rolvak);

  var acties = el('div', 'knoprij');
  if (ikZelf && m.id === ikZelf.id) {
    /* Jezelf. Geen knoppen die toch worden geweigerd -- de database
       houdt dit tegen, en een knop die altijd een foutmelding geeft is
       erger dan geen knop. */
    acties.appendChild(el('span', 'hint', 'Dat ben jij'));
  } else {
    acties.appendChild(knop('Aanpassen', 'stil', function () { toonAccountBewerken(m); }));
    acties.appendChild(knop('Nieuw wachtwoord', 'stil', function () {
      nieuwWachtwoord(m, schoolnaamVan(m.school_id));
    }));
    /* Weghalen ziet er anders uit dan de rest. Drie knoppen die er
       precies hetzelfde uitzien maakt de verkeerde even makkelijk te
       raken als de goede. */
    var weg = knop('Verwijderen', 'stil', function () { toonAccountWeg(m); });
    weg.classList.add('weg');
    acties.appendChild(weg);
  }
  r.appendChild(acties);
  return r;
}

/* ── een account aanpassen ────────────────────────────────────────────
   Naam, rol en school in één blad, maar onder water drie aparte stappen:
   de naam gaat rechtstreeks, de rol en de school gaan door een functie
   in de database die ook nakijkt of er geen school zonder beheerder
   achterblijft. Alleen wat je echt hebt veranderd wordt verstuurd. */
function toonAccountBewerken(m, concept){
  concept = concept || { naam: m.naam || '', rol: m.rol, school: m.school_id || '' };
  toonBlad(function (blad) {
    var t = el('div', null, m.naam || m.gebruikersnaam || 'Account');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Zij logt in met ' + (m.gebruikersnaam || '—') + '. Die gebruikersnaam ' +
      'staat vast — een naam die onder iemand verandert is een naam waarmee ' +
      'ze de volgende ochtend buiten staat. Haar wachtwoord kun je wel vervangen.'));

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Naam'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.value = concept.naam; naam.placeholder = 'Juf Marieke';
    naam.addEventListener('input', function () { concept.naam = naam.value; });
    r1.appendChild(naam);
    blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'Rol'));
    var chips = el('div', 'knoprij');
    ['leerkracht', 'schoolbeheerder', 'platformbeheerder'].forEach(function (rol) {
      var c = el('button', 'chip' + (concept.rol === rol ? ' aan' : ''), ROLNAAM[rol]);
      c.addEventListener('click', function () {
        /* Opnieuw tekenen, want bij platformbeheerder valt het
           schoolveld weg -- en een veld dat er nog staat maar niets meer
           doet, liegt. Het concept gaat mee, dus wat al was ingevuld
           blijft staan. */
        concept.rol = rol; sluitBlad(); toonAccountBewerken(m, concept);
      });
      chips.appendChild(c);
    });
    r2.appendChild(chips);
    var roluitleg = el('div', 'hint');
    roluitleg.style.marginTop = '6px';
    roluitleg.textContent =
      concept.rol === 'platformbeheerder'
        ? 'Ziet alle scholen en kan accounts beheren. Hoort bij geen school — ' +
          'die wordt losgelaten en haar groepen gaan eraf.'
        : concept.rol === 'schoolbeheerder'
          ? 'Mag binnen haar eigen school alles: groepen, kinderen en collega’s.'
          : 'Ziet alleen de groepen waar ze aan is gekoppeld.';
    r2.appendChild(roluitleg);
    blad.appendChild(r2);

    if (concept.rol !== 'platformbeheerder') {
      var r3 = el('div', 'veldrij');
      r3.appendChild(el('label', 'veldlabel', 'School'));
      var kies = el('select', 'invoer');
      var geen = el('option', null, 'Geen school');
      geen.value = ''; if (!concept.school) geen.selected = true;
      kies.appendChild(geen);
      scholenRij.slice().sort(function (a, b) { return a.naam.localeCompare(b.naam); })
        .forEach(function (s) {
          var o = el('option', null, s.naam);
          o.value = s.id; if (s.id === concept.school) o.selected = true;
          kies.appendChild(o);
        });
      r3.appendChild(kies);
      var waarschuwing = el('div', 'waarschuwing');
      waarschuwing.style.display = 'none';
      r3.appendChild(waarschuwing);
      blad.appendChild(r3);

      /* Verhuizen is geen kleinigheid, dus het staat er voordat je op
         Opslaan drukt en niet erna. Haar groepen gaan niet mee: die zijn
         van de oude school, en een koppeling die blijft staan zou haar
         bij kinderen laten die niet meer de hare zijn. */
      var waarschuw = function (){
        var anders = (concept.school || '') !== (m.school_id || '');
        waarschuwing.style.display = anders ? '' : 'none';
        if (anders) {
          waarschuwing.textContent =
            'Zij gaat van ' + (m.school_id ? schoolnaamVan(m.school_id) : 'geen school') +
            ' naar ' + (concept.school ? schoolnaamVan(concept.school) : 'geen school') +
            '. Haar groepen gaan niet mee: op de nieuwe school moet de ' +
            'schoolbeheerder haar opnieuw aan groepen koppelen.';
        }
      };
      kies.addEventListener('change', function () { concept.school = kies.value; waarschuw(); });
      waarschuw();
    }

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    var bewaar = knop('Opslaan', 'primair', function () {
      var stappen = [];
      var nieuweNaam = (concept.naam || '').trim();
      if (nieuweNaam !== (m.naam || '')) {
        stappen.push(function () {
          return SB.wijzig('profielen', { naam: nieuweNaam }, { id:'eq.' + m.id });
        });
      }
      if (concept.rol !== m.rol) {
        stappen.push(function () {
          return SB.roep('account_rol', { wie: m.id, nieuwe_rol: concept.rol });
        });
      }
      /* Eerst de rol, dan de school: wie net geen platformbeheerder meer
         is kan pas daarna bij een school horen. */
      var doelSchool = concept.rol === 'platformbeheerder' ? null : (concept.school || null);
      if (doelSchool !== (m.school_id || null) && concept.rol !== 'platformbeheerder') {
        stappen.push(function () {
          return SB.roep('account_verplaatsen', { wie: m.id, nieuwe_school: doelSchool });
        });
      }
      if (!stappen.length) { sluitBlad(); return; }

      bewaar.disabled = true; bewaar.textContent = 'Bezig…';
      stappen.reduce(function (keten, stap) { return keten.then(stap); }, Promise.resolve())
        .then(function () { return haalAlles(); })
        .then(function () { sluitBlad(); teken(); meld('Opgeslagen'); },
              function (e) {
                bewaar.disabled = false; bewaar.textContent = 'Opslaan';
                meld((e && e.message) || 'Dat lukte niet');
              });
    });
    rij.appendChild(bewaar);
    blad.appendChild(rij);
    zetCursor(naam, blad);
  });
}
function toonAccountWeg(m){
  var wie = m.naam || m.gebruikersnaam || 'dit account';
  toonBlad(function (blad) {
    var t = el('div', null, wie + ' verwijderen');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Het account gaat echt weg: de inlog, het profiel en de koppelingen aan ' +
      'groepen. Dit kan niet terug — een nieuw account voor dezelfde persoon ' +
      'is een nieuw account.'));
    blad.appendChild(el('p', 'hint',
      'Wat blijft: de kinderen, de groepen en alles wat er op de borden is ' +
      'gebeurd. Die horen bij de school, niet bij de leerkracht die toevallig ' +
      'was ingelogd. En de regels in het logboek blijven ook staan.'));

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Verwijderen', 'gevaar', function () {
      SB.roep('account_verwijderen', { wie: m.id })
        .then(function () { return haalAlles(); })
        .then(function () { sluitBlad(); teken(); meld(wie + ' is verwijderd'); },
              function (e) { meld((e && e.message) || 'Dat lukte niet'); });
    }));
    blad.appendChild(rij);
  });
}

/* ── een account erbij ────────────────────────────────────────────────
   Dezelfde weg als in het schoolbeheer: eerst een uitnodiging klaarzetten
   op het interne adres, dan het account aanmaken. In die volgorde, want
   de trekker in de database kijkt bij het aanmaken of er een uitnodiging
   ligt en koppelt daar school en rol aan. Andersom staat ze binnen zonder
   school, en dan krijgt ze het scherm "begin een school" te zien. */
function toonNieuwAccount(voorSchool){
  var concept = { naam:'', gebruikersnaam:'', zelfGekozen:false,
                  rol:'leerkracht', school: voorSchool || '' };
  toonBlad(function (blad) {
    var t = el('div', null, 'Account toevoegen');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Het account staat meteen klaar en je krijgt een kaartje om uit te printen. ' +
      'Er gaat van ons geen mail uit — geef het kaartje zelf even door.'));

    var r0 = el('div', 'veldrij');
    r0.appendChild(el('label', 'veldlabel', 'Bij welke school?'));
    var kies = el('select', 'invoer');
    var geen = el('option', null, 'Kies een school…'); geen.value = '';
    kies.appendChild(geen);
    scholenRij.slice().sort(function (a, b) { return a.naam.localeCompare(b.naam); })
      .forEach(function (s) {
        var o = el('option', null, s.naam);
        o.value = s.id; if (s.id === concept.school) o.selected = true;
        kies.appendChild(o);
      });
    kies.addEventListener('change', function () { concept.school = kies.value; });
    r0.appendChild(kies);
    blad.appendChild(r0);

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Naam'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.placeholder = 'Juf Marieke';
    r1.appendChild(naam);
    blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'Gebruikersnaam'));
    var gn = el('input', 'invoer');
    gn.type = 'text'; gn.placeholder = 'juf.marieke';
    gn.autocapitalize = 'off'; gn.spellcheck = false;
    r2.appendChild(gn);
    var stand = el('div', 'hint');
    stand.style.marginTop = '4px';
    r2.appendChild(stand);
    blad.appendChild(r2);

    var kijker = null;
    function kijkNaam(){
      var n = concept.gebruikersnaam;
      clearTimeout(kijker);
      stand.style.color = '';
      if (!n) { stand.textContent = ''; return; }
      stand.textContent = 'Even kijken…';
      kijker = setTimeout(function () {
        SB.roep('gebruikersnaam_vrij', { gewenst: n }).then(function (vrij) {
          stand.textContent = vrij ? 'Vrij. Ze logt straks in met ' + n + '.'
                                   : 'Die naam is al in gebruik. Kies een andere.';
          stand.style.color = vrij ? '' : 'var(--stop)';
        }, function () { stand.textContent = ''; });
      }, 350);
    }
    naam.addEventListener('input', function () {
      concept.naam = naam.value;
      if (!concept.zelfGekozen) {
        gn.value = SB.gebruikersnaamNet(naam.value);
        concept.gebruikersnaam = gn.value;
        kijkNaam();
      }
    });
    gn.addEventListener('input', function () {
      concept.zelfGekozen = true;
      gn.value = SB.gebruikersnaamNet(gn.value);
      concept.gebruikersnaam = gn.value;
      kijkNaam();
    });

    var r3 = el('div', 'veldrij');
    r3.appendChild(el('label', 'veldlabel', 'Rol'));
    var chips = el('div', 'knoprij');
    [['leerkracht', 'Leerkracht'], ['schoolbeheerder', 'Schoolbeheerder']]
      .forEach(function (paar) {
        var c = el('button', 'chip' + (concept.rol === paar[0] ? ' aan' : ''), paar[1]);
        c.addEventListener('click', function () {
          concept.rol = paar[0];
          [].forEach.call(chips.children, function (k) { k.classList.remove('aan'); });
          c.classList.add('aan');
        });
        chips.appendChild(c);
      });
    r3.appendChild(chips);
    blad.appendChild(r3);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    var maak = knop('Aanmaken', 'primair', function () {
      var persoon = (concept.naam || '').trim();
      var gebruiker = SB.gebruikersnaamNet(concept.gebruikersnaam);
      if (!concept.school) { meld('Kies eerst een school'); kies.focus(); return; }
      if (!persoon)   { meld('Vul een naam in'); naam.focus(); return; }
      if (!gebruiker) { meld('Vul een gebruikersnaam in'); gn.focus(); return; }

      var ww;
      try { ww = KBKAARTJE.wachtwoord(); }
      catch (e) { meld('Deze browser kan geen veilig wachtwoord maken. Probeer een andere.'); return; }

      maak.disabled = true; maak.textContent = 'Bezig…';
      var schoolnaam = schoolnaamVan(concept.school);
      SB.schrijf('uitnodigingen', [{ school_id: concept.school,
                                     email: SB.inlogadres(gebruiker),
                                     rol: concept.rol, code: nieuweCode() }])
        .then(function () { return SB.maakAccountVoor(gebruiker, ww, persoon); })
        .then(function () { return haalAlles(); })
        .then(function () {
          sluitBlad(); teken();
          toonKaartje({ naam: persoon, gebruikersnaam: gebruiker, wachtwoord: ww,
                        rol: concept.rol, school: schoolnaam });
        }, function (err) {
          maak.disabled = false; maak.textContent = 'Aanmaken';
          var bericht = (err && err.message) || '';
          if (SB.isTeVaak(err)) {
            meld('Supabase laat maar dertig aanmeldingen per vijf minuten toe vanaf één plek. Wacht vijf minuten en ga dan verder — er is niets misgegaan.');
          } else if (/duplicate|unique|al een account|already/i.test(bericht)) {
            meld('Die gebruikersnaam is al in gebruik. Kies een andere.');
          } else {
            meld('Dat lukte niet: ' + bericht);
          }
        });
    });
    rij.appendChild(maak);
    blad.appendChild(rij);
    zetCursor(naam, blad);
  });
}

/* Een code voor de uitnodiging. Dezelfde vorm als in het schoolbeheer:
   acht tekens zonder de letters en cijfers die op elkaar lijken, zodat
   je hem ook door de telefoon kunt doorgeven. */
var CODETEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function nieuweCode(){
  var uit = '';
  var ruw = new Uint8Array(8);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(ruw);
  else for (var j = 0; j < 8; j++) ruw[j] = Math.floor(Math.random() * 256);
  for (var i = 0; i < 8; i++) uit += CODETEKENS.charAt(ruw[i] % CODETEKENS.length);
  return uit;
}

/* ── de naam van een school aanpassen ────────────────────────────────
   Een school die van naam verandert (een fusie, een typefout bij het
   aanmaken) hoeft daarvoor niet opnieuw te worden opgezet. De school
   kan dit zelf ook, bij "De school"; dit is er voor het geval zij het
   vraagt in plaats van het zelf te doen. */
function toonSchoolAanpassen(c){
  toonBlad(function (blad) {
    var t = el('div', null, 'Naam van de school');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'De naam staat op de inlogkaartjes en bovenaan het scherm van de school. ' +
      'Kleuren en logo stelt de school zelf in.'));

    var r = el('div', 'veldrij');
    r.appendChild(el('label', 'veldlabel', 'Naam'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.value = c.naam; naam.id = 'schoolnaamveld';
    r.appendChild(naam);
    blad.appendChild(r);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Opslaan', 'primair', function () {
      var nieuw = (naam.value || '').trim();
      if (!nieuw) { meld('Een school heeft een naam nodig'); naam.focus(); return; }
      if (nieuw === c.naam) { sluitBlad(); return; }
      // het logboek van de school schrijft de database zelf (school_bewaken)
      SB.wijzig('scholen', { naam: nieuw }, { id:'eq.' + c.school_id })
        .then(function () { return haalAlles(); })
        .then(function () { sluitBlad(); teken(); meld('De school heet nu ' + nieuw); },
              function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    }));
    blad.appendChild(rij);
    zetCursor(naam, blad);
    setTimeout(function () { if (document.activeElement === naam) naam.select(); }, 70);
  });
}

/* ── een school opheffen ─────────────────────────────────────────────
   Niet terug te draaien, dus de naam moet worden overgetypt. Een
   bevestigingsknop is te makkelijk aan te klikken, en dit is precies de
   handeling waarvan je niet wilt dat iemand hem per ongeluk doet.

   Het logboek blijft staan: dat hangt met 'set null' aan de school. Het
   opheffen van een school hoort niet ook het bewijs te wissen van wat er
   bij die school is gebeurd. */
function verwijderSchool(c){
  var getypt = '';
  toonBlad(function (blad) {
    var t = el('div', null, c.naam + ' opheffen');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Alles van deze school gaat weg: ' + c.groepen +
      (c.groepen === 1 ? ' groep, ' : ' groepen, ') + c.leerlingen +
      (c.leerlingen === 1 ? ' kind, ' : ' kinderen, ') + c.leerkrachten +
      (c.leerkrachten === 1 ? ' account' : ' accounts') +
      ', en alles wat er op hun borden is gebeurd. Dit kan niet terug.'));
    blad.appendChild(el('p', 'hint',
      'Vraag ze eerst om bij "De school" op Uitdraaien te drukken \u2014 ' +
      'daarna kunnen ze er zelf niet meer bij.'));

    var r = el('div', 'veldrij');
    r.appendChild(el('label', 'veldlabel', 'Typ de naam van de school over'));
    var invoer = el('input', 'invoer');
    invoer.type = 'text'; invoer.id = 'schoolnaamcontrole';
    invoer.placeholder = c.naam;
    invoer.addEventListener('input', function () { getypt = invoer.value; });
    r.appendChild(invoer);
    blad.appendChild(r);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Opheffen', 'gevaar', function () {
      SB.roep('school_verwijderen', { school: c.school_id, naam_ter_controle: getypt })
        .then(function (uit) {
          sluitBlad();
          return haalAlles().then(function () {
            teken();
            meld((uit && uit.naam ? uit.naam : 'De school') + ' is opgeheven');
          });
        }, function (e) { meld((e && e.message) || 'Dat lukte niet'); });
    }));
    blad.appendChild(rij);
    zetCursor(invoer, blad);
  });
}

function toonVoorbeeld(){
  toonBlad(function (blad) {
    var t = el('div', null, 'Voorbeeldschool');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Een hele school om te laten zien: drie groepen, vijf hoeken per ' +
      'groep en vijf verzonnen kinderen. Geen echte namen, dus je kunt hem ' +
      'aan iedereen laten zien.'));

    var r = el('div', 'veldrij');
    r.appendChild(el('label', 'veldlabel', 'Naam'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.value = 'Voorbeeldschool';
    r.appendChild(naam);
    blad.appendChild(r);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Aanmaken', 'primair', function () {
      SB.roep('voorbeeldschool_aanmaken', { schoolnaam: (naam.value || 'Voorbeeldschool').trim() })
        .then(function () {
          sluitBlad();
          return haalAlles().then(function () { teken(); meld('De voorbeeldschool staat klaar'); });
        }, function (err) { meld('Dat lukte niet: ' + (err && err.message)); });
    }));
    blad.appendChild(rij);
    zetCursor(naam, blad);
    setTimeout(function () { if (document.activeElement === naam) naam.select(); }, 70);
  });
}

/* ── opstarten ────────────────────────────────────────────────── */

$('afmelden').addEventListener('click', function (e) {
  e.preventDefault();
  SB.afmelden().then(function () { location.href = 'inloggen.html'; },
                     function () { location.href = 'inloggen.html'; });
});

tekenMenu();
SB.wieBenIk().then(function (ik) {
  /* Dit scherm is van de platformbeheerder. Wie hier anders komt sturen
     we weg -- niet omdat het scherm gevaarlijk is (de database laat hem
     toch niets zien), maar omdat een leeg scherm vol uitleg over rechten
     die je niet hebt alleen maar verwarrend is. */
  if (!ik || !ik.profiel || ik.profiel.rol !== 'platformbeheerder') {
    location.href = ik && ik.profiel && ik.profiel.school_id ? 'school.html' : 'inloggen.html';
    return null;
  }
  ikZelf = ik.profiel;
  return haalAlles().then(teken);
}).catch(function (e) {
  var v = leeg($('inhoud'));
  v.appendChild(kopregel('Geen verbinding', 'Dit scherm werkt alleen online'));
  v.appendChild(el('p', 'hint', (e && e.message) || 'Probeer het zo nog eens.'));
});

})();
