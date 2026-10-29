/* ══════════════════════════════════════════════════════════════
   VERHUIZING NAAR EEN NIEUW ADRES
   De app verhuist van GitHub Pages naar app.pixelplein.nl. Voor de
   browser zijn dat twee verschillende websites: wat er op het oude
   adres in de opslag staat, ziet het nieuwe adres nooit. Meestal is
   dat geen probleem -- inloggen haalt alles van de server. Maar het
   bord werkt offline door, en wat daar nog niet verstuurd is, staat
   alleen op dit apparaat. Stap je dan over, dan is het weg.

   Dus: op het oude adres een melding. Staat er nog iets klaar, dan
   zegt hij dat, en pas als alles verstuurd is wijst hij de weg naar
   het nieuwe adres. Meer niet -- geen overdracht van de opslag, geen
   automatisch doorsturen. Zie DECISIONS.md (29-10-2026).

   Aan of uit is KB_APP.verhuizing.aan, gezet door test/uitgeven.sh.
   Op het nieuwe adres, op een testserver en in de demo doet dit
   niets.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var WACHTEND = 'kb_wachtend';   // dezelfde vlag als in kb-sync.js
var ELKE = 3000;

function instelling(){
  var v = global.KB_APP && KB_APP.verhuizing;
  return (v && v.aan && v.van && v.naar) ? v : null;
}

function opOudAdres(v){
  try { return location.href.indexOf(v.van) === 0; } catch (e) { return false; }
}

function wachtErIetsOp(){
  try {
    return Object.keys(JSON.parse(localStorage.getItem(WACHTEND) || '{}')).length > 0;
  } catch (e) { return false; }
}

/* Het nieuwe adres zonder https:// -- zo staat het op het kaartje en
   zo typt een leerkracht het over. */
function kaal(adres){ return adres.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

function bouw(v){
  var vak = document.createElement('div');
  vak.className = 'verhuismelding';
  vak.id = 'verhuismelding';
  vak.setAttribute('role', 'status');

  var tekst = document.createElement('span');
  tekst.className = 'verhuis-tekst';
  vak.appendChild(tekst);

  /* Op het bord geen knop naar het nieuwe adres: daar staan kleuters
     met hun handen op, en één tik zou het bord van de klas naar een
     leeg inlogscherm sturen. De juf zet het nieuwe adres er zelf op. */
  var opBord = document.body.classList.contains('bord') ||
               /bord\.html$/.test(location.pathname);

  var stuur = document.createElement('button');
  stuur.type = 'button';
  stuur.className = 'knop knop-klein verhuis-stuur';
  stuur.textContent = 'Nu versturen';
  stuur.addEventListener('click', function () {
    if (global.KBV && KBV.stuurNu) KBV.stuurNu().catch(function () {}).then(teken);
  });
  vak.appendChild(stuur);

  var heen = document.createElement('a');
  heen.className = 'knop knop-klein verhuis-heen';
  heen.textContent = 'Naar ' + kaal(v.naar);
  heen.href = v.naar + (location.pathname.split('/').pop() || '');
  if (!opBord) vak.appendChild(heen);

  function teken(){
    var nog = wachtErIetsOp();
    vak.classList.toggle('wacht', nog);
    document.body.classList.toggle('verhuis-wacht', nog);
    if (nog) {
      tekst.textContent = 'Keuzebord verhuist naar ' + kaal(v.naar) + '. ' +
        'Op dit apparaat staan nog wijzigingen die niet verstuurd zijn. ' +
        /* Op het inlogscherm is er nog geen verbinding om mee te
           versturen; die komt pas na het inloggen. */
        (global.KBV && KBV.stuurNu
          ? 'Blijf online tot hier staat dat alles verstuurd is, en stap pas daarna over.'
          : 'Log eerst hier in, dan gaan ze vanzelf mee. Stap pas daarna over.');
    } else {
      tekst.textContent = 'Keuzebord verhuist naar ' + kaal(v.naar) + '. ' +
        'Alles op dit apparaat is verstuurd' +
        (opBord ? ': zet het nieuwe adres op dit digibord.' : ': je kunt overstappen.');
    }
    stuur.hidden = !nog || !(global.KBV && KBV.stuurNu);
    heen.hidden = nog;
  }

  teken();
  setInterval(teken, ELKE);
  global.addEventListener('storage', teken);
  return vak;
}

function plaats(){
  var v = instelling();
  if (!v || !opOudAdres(v)) return;
  if (/demo\.html$/.test(location.pathname)) return;
  if (document.getElementById('verhuismelding')) return;
  document.body.appendChild(bouw(v));
  document.body.classList.add('verhuizing');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', plaats);
} else {
  plaats();
}

global.KBVERHUIS = { plaats: plaats, wachtErIetsOp: wachtErIetsOp };

})(window);
