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
function meld(t){
  var m = $('melding'); m.textContent = t; m.classList.add('zichtbaar');
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(function () { m.classList.remove('zichtbaar'); }, 3200);
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
  { id:'databank', naam:'Hoeken-databank',
    icoon:'M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6' },
  { id:'logboek', naam:'Logboek',
    icoon:'M4 5h16M4 12h16M4 19h10' }
];
var huidig = 'scholen';
var cijfers  = [];
var deuren   = [];
var logboek  = [];
var databank = [];
var scholenRij = [];     // de scholen zelf, voor de modules

function haalAlles(){
  return Promise.all([
    SB.roep('schoolcijfers', {}),
    SB.lees('scholen', { kies:'id,naam,modules,huisstijl' }),
    SB.roep('databankcijfers', {}),
    SB.lees('ondersteuning', { kies:'*', volgorde:'tot.desc', hoeveel:50 }),
    SB.lees('handelingen',   { kies:'*', volgorde:'tijd.desc', hoeveel:40 })
  ]).then(function (uit) {
    cijfers  = uit[0] || [];
    scholenRij = uit[1] || [];
    databank = uit[2] || [];
    deuren   = uit[3] || [];
    logboek  = uit[4] || [];
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
      SB.wijzig('scholen', { modules: nieuw }, { id:'eq.' + c.school_id })
        .then(function () {
          return SB.roep('noteer', { wat: (!aan ? 'planbord aangezet' : 'planbord uitgezet'),
                                     school: c.school_id, waarover: c.naam }).catch(function () {});
        })
        .then(function () { return haalAlles(); })
        .then(function () { teken(); meld(!aan ? 'Planbord aan' : 'Planbord uit'); },
              function (e) { meld('Dat lukte niet: ' + (e && e.message)); });
    });
    modrij.appendChild(mk2);
    kaart.appendChild(modrij);

    var acties = el('div', 'knoprij');
    if (deur) acties.appendChild(knop('Meekijken', 'stil', function () { kiesGroep(c, deur); }));
    acties.appendChild(knop('Accounts', 'stil', function () { toonAccounts(c); }));
    acties.appendChild(knop('Opheffen', 'stil', function () { verwijderSchool(c); }));
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
          meld('Dat lukte niet: ' + (err && err.message));
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

/* ── de accounts van een school ───────────────────────────────────────
   Wie er bij een school hoort, en hun wachtwoord terug kunnen zetten.
   Dit is het enige wat de leverancier van een school mag zien zonder
   dat die school een deur openzet: namen en rollen, geen kinderen,
   geen borden, geen statistieken. Zie docs/ROLLEN.md.

   Waarom het er is: raakt de schoolbeheerder haar wachtwoord kwijt,
   dan is er verder niemand die haar kan helpen -- en een school waar
   niemand meer bij kan is een school die stilstaat. Een wachtwoord
   zetten geeft geen inzage; het maakt alleen een nieuw kaartje. */
function toonAccounts(c){
  toonBlad(function (blad) {
    var t = el('div', null, 'Accounts van ' + c.naam);
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Namen en rollen \u2014 verder niets. Een nieuw wachtwoord maakt het oude ' +
      'meteen onbruikbaar en levert een kaartje op om uit te printen.'));

    var vak = el('div');
    vak.appendChild(el('p', 'hint', 'Bezig met ophalen\u2026'));
    blad.appendChild(vak);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Sluiten', 'stil', sluitBlad));
    blad.appendChild(rij);

    SB.lees('profielen', { kies:'id,naam,rol,gebruikersnaam',
                           waar:{ school_id:'eq.' + c.school_id },
                           volgorde:'rol,naam' }).then(function (mensen) {
      vak.innerHTML = '';
      if (!(mensen || []).length) {
        vak.appendChild(el('p', 'hint', 'Er hoort nog niemand bij deze school.'));
        return;
      }
      mensen.forEach(function (m) {
        var r = el('div', 'ledenrij');
        var links = el('div');
        links.appendChild(el('div', 'ledennaam', m.naam || m.gebruikersnaam || '\u2014'));
        links.appendChild(el('div', 'ledenmail',
          (m.gebruikersnaam ? m.gebruikersnaam + ' \u00b7 ' : '') +
          (m.rol === 'schoolbeheerder' ? 'schoolbeheerder' : 'leerkracht')));
        r.appendChild(links);
        r.appendChild(knop('Nieuw wachtwoord', 'stil', function () {
          nieuwWachtwoord(m, c.naam);
        }));
        vak.appendChild(r);
      });
    }, function (e) {
      vak.innerHTML = '';
      vak.appendChild(el('p', 'hint', 'Ophalen lukte niet: ' + (e && e.message)));
    });
  });
}

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
  return haalAlles().then(teken);
}).catch(function (e) {
  var v = leeg($('inhoud'));
  v.appendChild(kopregel('Geen verbinding', 'Dit scherm werkt alleen online'));
  v.appendChild(el('p', 'hint', (e && e.message) || 'Probeer het zo nog eens.'));
});

})();
