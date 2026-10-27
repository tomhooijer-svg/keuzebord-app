/* ══════════════════════════════════════════════════════════════
   TESTVERSIE
   Zolang de app bij een paar scholen op proef draait, hoort dat
   ergens te staan. Niet omdat het mooi is, maar omdat een
   leerkracht die iets geks ziet moet weten dat dit geen afgerond
   product is -- dan meldt ze het in plaats van het weg te wuiven.
   Het versienummer staat erbij, zodat jij weet welke code ze voor
   zich had toen ze het meldde.

   Twee regels waar dit zich aan houdt:

   1. Het is klein. Een balk over de hele breedte is lelijk en
      eet ruimte op een digibord waar elke pixel voor de hoeken
      is. Dit is een chip ter grootte van een woord.
   2. Op het bord kun je hem inklappen tot een stip. Kleuters
      staan er met hun handen bovenop; wat niet van hen is hoort
      zo klein mogelijk te zijn. De keuze blijft onthouden in
      deze browser, per apparaat -- het digibord van groep 1A
      hoeft niet te weten wat de iPad van de juf doet.

   Aan of uit is één schakelaar: KB_APP.testversie, gezet door
   test/uitgeven.sh. Gaat de app echt in gebruik, dan staat hij
   daar op false en is dit overal weg.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var SLEUTEL = 'kb_testchip_klein';

function aan(){ return !!(global.KB_APP && KB_APP.testversie); }

/* Welke versie dit is. KB.VERSIE is de datum die de leerkracht
   herkent; de bouwvingerafdruk erachter is voor jou, om twee
   uitgaven van dezelfde dag uit elkaar te houden.

   Op het bord alleen de datum. Daar staat de chip in de bovenbalk
   naast de groepsnaam, en acht tekens hexadecimaal maken hem daar
   twee keer zo breed voor iemand die er niets aan heeft. In het
   beheer, waar jij meekijkt, staat hij er wel bij -- en de
   feedbackknop stuurt hem straks sowieso mee. */
function versietekst(metBouw){
  var datum = (global.KB && KB.VERSIE) ||
              (global.KB_APP && KB_APP.versie) || '';
  var bouw  = metBouw ? ((global.KB_APP && KB_APP.bouw) || '') : '';
  if (datum && bouw) return datum + ' · ' + bouw;
  return datum || bouw || '';
}

function klein(){
  try { return localStorage.getItem(SLEUTEL) === 'ja'; } catch (e) { return false; }
}
function zetKlein(ja){
  try { localStorage.setItem(SLEUTEL, ja ? 'ja' : 'nee'); } catch (e) {}
}

function maakStip(){
  var s = document.createElement('span');
  s.className = 'testchip-stip';
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/* De rustige versie: in de zijbalk van het beheer. Geen knop --
   daar zit niemand in de weg, dus hij hoeft ook niet weg te
   kunnen. */
function inZijbalk(){
  var kop = document.querySelector('.zijbalk .zij-kop');
  if (!kop || kop.querySelector('.testmerk')) return;
  var merk = document.createElement('div');
  merk.className = 'testmerk';
  merk.appendChild(maakStip());
  var t = document.createElement('span');
  t.textContent = 'Testversie';
  merk.appendChild(t);
  var v = versietekst(true);
  if (v) {
    var vn = document.createElement('span');
    vn.className = 'testmerk-versie';
    vn.textContent = v;
    merk.appendChild(vn);
  }
  /* Onder de twee regels tekst, binnen dezelfde kop -- die is een
     rij, dus het hoort in de tekstkolom ernaast. */
  var kolom = kop.querySelector('.zij-kop-tekst') || kop;
  kolom.appendChild(merk);
}

/* De inklapbare versie: in de bovenbalk van het bord. */
function opBord(){
  var links = document.querySelector('.balk .balk-links');
  if (!links || links.querySelector('.testchip')) return;

  var chip = document.createElement('button');
  chip.className = 'testchip';
  chip.id = 'testchip';
  chip.type = 'button';

  var stip = maakStip();
  var woord = document.createElement('span');
  woord.className = 'testchip-woord';

  function teken(){
    var k = klein();
    chip.classList.toggle('klein', k);
    /* En op de pagina zelf, zoals deze app zijn schermstanden overal
       bijhoudt (body.bord, body.beheer, body.inlog). Dat is hier geen
       sierlijkheid: een knop die alleen zichzelf verandert is voor de
       proef in test/knoppen.test.js niet te onderscheiden van een knop
       die stuk is. Die proef klikt elke knop op elk scherm aan en kijkt
       of het scherm er daarna anders uitziet -- precies de controle die
       een dode knop vangt, en die wil ik overeind houden. Met de stand
       op body staat hij in die afdruk, en klopt het verhaal ook. */
    document.body.classList.toggle('testversie-klein', k);
    var v = versietekst(false);
    woord.textContent = 'Testversie' + (v ? ' · ' + v : '');
    chip.title = k ? 'Testversie' + (v ? ' · ' + v : '') + ' — tik om uit te klappen'
                   : 'Tik om in te klappen';
    chip.setAttribute('aria-label', k ? 'Testversie, uitklappen' : 'Testversie, inklappen');
  }

  chip.appendChild(stip);
  chip.appendChild(woord);
  chip.addEventListener('click', function () { zetKlein(!klein()); teken(); });
  teken();
  links.appendChild(chip);
}

function plaats(){
  if (!aan()) return;
  inZijbalk();
  opBord();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', plaats);
} else {
  plaats();
}

global.KBTEST = { aan: aan, plaats: plaats, versietekst: versietekst };

})(window);
