/* ═══════════════════════════════════════════════════════════════════════
   Doelen zoeken bij een omschrijving

   Je typt "de kinderen knippen een blad uit en plakken het op", en dan
   hoort het doel "Experimenteren met knippen" er vanzelf bij te staan.

   Geen slimmigheid van elders: het is woordvergelijking. We halen de
   inhoudswoorden uit wat je typt, doen hetzelfde met elk doel, en kijken
   welke op elkaar lijken. Nederlandse woorden buigen achteraan ("knippen",
   "knipt", "geknipt"), dus we vergelijken op het begin van een woord en
   niet op het geheel.

   Het blijft een suggestie. Je kiest zelf wat er echt bij hoort.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
'use strict';

/* Woorden die in elke zin staan en dus niets zeggen over de inhoud. */
var GEENINHOUD = ('de het een en of met van in op te is zijn worden wordt was ' +
  'dat die deze dit er niet wel ook nog naar voor door uit bij om aan als ' +
  'ze zij hij we wij je jij ik jullie hun hen zich elkaar ' +
  'kind kinderen kleuter kleuters leerling leerlingen groepje groepjes klas ' +
  'gaan gaat ging doen doet deed laten laat maken maakt maakte ' +
  'samen daarna dan eerst daarna vervolgens steeds telkens weer ' +
  'alle elke elk iets wat hoe waar wanneer welke veel weinig meer minder ' +
  'kunnen kan kon mogen mag moeten moet willen wil ' +
  'goed leuk mooi klaar bezig tijdens terwijl zodat omdat want maar ' +
  'hier daar dit dat zo heel erg beetje wat ' +
  'tot over onder tussen na per dus al af toe zelf even nieuwe nieuw ander andere ' +
  'oefenen oefent oefening leren leert leerde proberen probeert werken werkt ' +
  'bijv bijvoorbeeld o.a. etc enz ').split(/\s+/);

var STOP = {};
GEENINHOUD.forEach(function (w) { if (w) STOP[w] = true; });

/* Een paar woorden die kleuterjuffen anders zeggen dan de doelenlijst. */
var ZELFDE = {
  plakken:'lijm', lijmen:'lijm', kleven:'lijm',
  kleuren:'kleur', inkleuren:'kleur', tekenen:'teken',
  prikken:'prik', rijgen:'rijg', vouwen:'vouw', scheuren:'scheur',
  kleien:'klei', boetseren:'klei',
  bouwen:'bouw', stapelen:'bouw',
  tellen:'tel', turven:'tel', rekenen:'reken',
  meten:'meet', wegen:'weeg',
  schrijven:'schrijf', letters:'letter', woorden:'woord',
  praten:'spreek', vertellen:'vertel', luisteren:'luister',
  zingen:'zing', dansen:'dans', bewegen:'beweeg',
  puzzelen:'puzzel', spelen:'spel', samenspelen:'samen'
};

function woorden(tekst){
  return String(tekst || '')
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(function (w) { return ZELFDE[w] || w; })
    .filter(function (w) { return w.length >= 3 && !STOP[w]; });
}

/* Nederlandse woorden buigen achteraan: knippen, knipt, geknipt. We halen
   die uitgangen eraf zodat er een stam overblijft om mee te vergelijken. */
var UITGANGEN = ['enden','ende','eren','eren','ingen','ing','den','ten','en','de','te','t','s','je','en'];
function stam(w){
  for (var i = 0; i < UITGANGEN.length; i++) {
    var u = UITGANGEN[i];
    if (w.length - u.length >= 4 && w.slice(-u.length) === u) return w.slice(0, -u.length);
  }
  return w;
}

/* Twee woorden horen bij elkaar als hun stammen gelijk zijn, of als de
   ene stam met de andere begint en er hooguit een paar letters verschil
   is. Dat laatste is de rem: zonder hem hoort "kastanjes" ineens bij
   "kast", en dan komt er onzin bovendrijven. */
function lijktOp(a, b){
  if (a === b) return true;
  var sa = stam(a), sb = stam(b);
  if (sa === sb) return true;
  var kort = sa.length < sb.length ? sa : sb;
  var lang = sa.length < sb.length ? sb : sa;
  if (kort.length < 4) return false;
  if (lang.length - kort.length > 3) return false;
  return lang.indexOf(kort) === 0;
}

/* Waar in een doel het woord voorkomt telt mee: in de doelzin zelf is
   sterker dan in de naam van de leerlijn. */
var GEWICHT = { doel: 3, aspect: 2, leerlijn: 1.5, domein: 1 };

function doelWoorden(d){
  if (d._woorden) return d._woorden;
  var uit = [];
  ['doel','aspect','leerlijn','domein'].forEach(function (veld) {
    woorden(d[veld]).forEach(function (w) { uit.push({ woord:w, gewicht:GEWICHT[veld] }); });
  });
  try { Object.defineProperty(d, '_woorden', { value: uit, enumerable: false }); }
  catch (e) { d._woorden = uit; }
  return uit;
}

/* De hoofdvraag: welke doelen passen bij deze tekst?
   opties.niveaus  — niveaus van de groep; die wegen zwaarder mee
   opties.hoeveel  — hoeveel suggesties je wilt (standaard 6)
   opties.drempel  — hoe zeker het minstens moet zijn (standaard 3) */
function suggesties(tekst, lijst, opties){
  opties = opties || {};
  var vraag = woorden(tekst);
  if (!vraag.length) return [];

  var niveaus = {};
  (opties.niveaus || []).forEach(function (n) { niveaus[n] = true; });
  var hoeveel = opties.hoeveel || 6;
  var drempel = opties.drempel == null ? 3 : opties.drempel;

  var uit = [];
  (lijst || []).forEach(function (d) {
    var punten = 0;
    var geraakt = {};
    doelWoorden(d).forEach(function (dw) {
      for (var i = 0; i < vraag.length; i++) {
        if (lijktOp(vraag[i], dw.woord)) {
          // hetzelfde woord telt maar één keer, op zijn zwaarste plek
          if (!geraakt[vraag[i]] || geraakt[vraag[i]] < dw.gewicht) {
            punten += dw.gewicht - (geraakt[vraag[i]] || 0);
            geraakt[vraag[i]] = dw.gewicht;
          }
          break;
        }
      }
    });
    if (punten < drempel) return;

    // meer verschillende woorden geraakt is overtuigender dan één woord
    // dat toevallig vaak voorkomt
    var aantal = Object.keys(geraakt).length;
    punten *= (1 + (aantal - 1) * 0.4);
    // een doel op het niveau van de groep is waarschijnlijker bedoeld
    if (niveaus[d.niveau]) punten *= 1.5;
    if (d.ster) punten *= 1.1;

    uit.push({ doel:d, punten:punten, woorden:Object.keys(geraakt) });
  });

  uit.sort(function (a, b) {
    if (b.punten !== a.punten) return b.punten - a.punten;
    return String(a.doel.niveau).localeCompare(String(b.doel.niveau));
  });
  return uit.slice(0, hoeveel);
}

global.KBDOELZOEKER = {
  suggesties: suggesties,
  woorden: woorden,
  lijktOp: lijktOp
};

})(typeof window !== 'undefined' ? window : globalThis);
