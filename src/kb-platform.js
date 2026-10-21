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

function haalAlles(){
  return Promise.all([
    SB.roep('schoolcijfers', {}),
    SB.roep('databankcijfers', {}),
    SB.lees('ondersteuning', { kies:'*', volgorde:'tot.desc', hoeveel:50 }),
    SB.lees('handelingen',   { kies:'*', volgorde:'tijd.desc', hoeveel:40 })
  ]).then(function (uit) {
    cijfers  = uit[0] || [];
    databank = uit[1] || [];
    deuren   = uit[2] || [];
    logboek  = uit[3] || [];
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
      huidig = o.id; tekenMenu(); teken();
      /* Opnieuw ophalen, want de cijfers veranderen buiten dit scherm om:
         een school kopieert een hoek, een beheerder zet de deur open. */
      haalAlles().then(teken, function () {});
    });
    vak.appendChild(b);
  });
}

function teken(){
  var v = leeg($('inhoud'));
  if (huidig === 'logboek')  return tekenLogboek(v);
  if (huidig === 'databank') return tekenDatabank(v);
  return tekenScholen(v);
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
        'Deur open tot ' + datum(deur.tot) + (deur.reden ? ' — ' + deur.reden : '')));
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

/* ── een school erbij ─────────────────────────────────────────── */

function toonNieuweSchool(){
  var concept = { naam:'', email:'' };
  toonBlad(function (blad) {
    var t = el('div', null, 'Nieuwe school');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'De school krijgt meteen een schoolbeheerder uitgenodigd. Zonder ' +
      'beheerder is het een school waar niemand bij kan.'));

    var r1 = el('div', 'veldrij');
    r1.appendChild(el('label', 'veldlabel', 'Naam van de school'));
    var naam = el('input', 'invoer');
    naam.type = 'text'; naam.placeholder = 'Kindcentrum De Regenboog';
    naam.value = concept.naam;
    naam.addEventListener('input', function () { concept.naam = naam.value; });
    r1.appendChild(naam);
    blad.appendChild(r1);

    var r2 = el('div', 'veldrij');
    r2.appendChild(el('label', 'veldlabel', 'E-mailadres van de schoolbeheerder'));
    var mail = el('input', 'invoer');
    mail.type = 'email'; mail.placeholder = 'ict@deregenboog.nl';
    mail.value = concept.email;
    mail.addEventListener('input', function () { concept.email = mail.value; });
    r2.appendChild(mail);
    blad.appendChild(r2);

    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Annuleren', 'stil', sluitBlad));
    rij.appendChild(knop('Aanmaken', 'primair', function () {
      var n = (concept.naam || '').trim();
      var e = (concept.email || '').trim();
      if (!n) { meld('Geef de school een naam'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { meld('Dat lijkt geen geldig e-mailadres'); return; }
      SB.roep('school_aanmaken', { schoolnaam: n, beheerder_email: e })
        .then(function (uit) {
          sluitBlad();
          return haalAlles().then(function () { teken(); toonCode(e, uit && uit.code); });
        }, function (err) { meld('Dat lukte niet: ' + (err && err.message)); });
    }));
    blad.appendChild(rij);
    zetCursor(naam, blad);
  });
}

function toonCode(email, code){
  toonBlad(function (blad) {
    var t = el('div', null, 'De school staat klaar');
    t.style.cssText = 'font-size:1.25rem;font-weight:600;letter-spacing:-.02em;margin-bottom:8px';
    blad.appendChild(t);
    blad.appendChild(el('p', 'hint',
      'Geef deze code door aan ' + email + '. Daarmee komt dat account als ' +
      'schoolbeheerder binnen. De code vervalt na drie weken.'));
    var vak = el('div', 'codevak');
    vak.appendChild(el('div', 'codetekst', code || '—'));
    blad.appendChild(vak);
    var rij = el('div', 'knoprij-onder');
    rij.appendChild(knop('Klaar', 'primair', sluitBlad));
    blad.appendChild(rij);
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
