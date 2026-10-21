/* ══════════════════════════════════════════════════════════════
   DE DEMO
   Een speeltuin voor wie wil zien hoe het werkt. Geen account, geen
   server, geen gegevens van een echte school -- alles staat in de
   browser van de bezoeker en gaat nergens heen.

   Het bord is van zichzelf al local-first; de demo haalt alleen de
   serverlaag weg en zet er een groep met verzonnen kinderen in. Zie
   kb-data.js voor de eigen opslagsleutels, en bord.html voor hoe de
   schakelaar wordt gezet.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';
if (!global.KB_DEMO) return;

var KINDEREN = ['Bram','Isa','Kees','Yara','Otis','Loua','Sam','Fenne',
                'Joep','Nora','Timo','Wies','Levi','Roos','Cas','Maud'];
/* Zes hoeken met een plek of vier: genoeg om te zien dat een hoek vol
   kan raken, en weinig genoeg om op één scherm te passen. */
var HOEKEN = [['Bouwhoek', 4, '#3b6ff0'], ['Huishoek', 3, '#b8436d'],
              ['Zandtafel', 4, '#c8820a'], ['Knutselhoek', 4, '#2e9e6b'],
              ['Leeshoek', 3, '#7c5cbf'], ['Ontdekhoek', 4, '#1a9aad']];

function vullen(){
  var k = KB.leegKlas('Groep 1A');
  k.hoekLib = HOEKEN.map(function (h, i) {
    return { id:'demo-hoek-' + i, naam:h[0], maxKinderen:h[1], kleur:h[2],
             timerMinuten:0, fotoId:null, leerlijnen:[] };
  });
  var b = k.borden[0];
  b.hoekLibIds = k.hoekLib.map(function (h) { return h.id; });
  k.hoekLib.forEach(function (h) { b.plaatsingen[h.id] = []; });

  KINDEREN.forEach(function (naam, i) {
    k.leerlingen.push({ id:'demo-kind-' + i, naam:naam,
                        kleur:KB.KIND_KLEUREN[i % KB.KIND_KLEUREN.length],
                        image:null, lid:true });
  });

  /* De wachtrij staat aan, want "de hoek is vol, ik wil er straks in" is
     juist het stukje dat je wilt laten zien. */
  k.settings.wachtrijAan = true;
  k.settings.tellingAan  = true;

  KB.G.klassen = [k];
  KB.G.activeKlasId = k.id;
  if (KB.zetBeheerKlas) KB.zetBeheerKlas(k.id);
  KB.bewaar();
}

function opnieuw(){
  try {
    localStorage.removeItem('kb_demo_v5');
    localStorage.removeItem('kb_demo_doelen');
    localStorage.removeItem('kb_demo_beheer_klas');
  } catch (e) {}
  location.reload();
}

function verlaten(){
  try {
    localStorage.removeItem('kb_demo');
    localStorage.removeItem('kb_demo_v5');
    localStorage.removeItem('kb_demo_doelen');
    localStorage.removeItem('kb_demo_beheer_klas');
  } catch (e) {}
  location.href = 'inloggen.html';
}

/* ── de balk onderin ────────────────────────────────────────
   Een strook over de volle breedte, en het scherm wordt er net zoveel
   korter van. Eerst zweefde hij over de onderrand -- en dat is precies
   waar de rij kinderen staat die je moet kunnen slepen. Een demobalk
   die het ding verbergt dat je wilt laten zien.

   Niet weg te klikken: een bezoeker moet op elk moment kunnen zien dat
   dit niet echt is. */
var HOOG = 52;

function balk(){
  if (document.getElementById('demobalk')) return;
  var stijl = document.createElement('style');
  stijl.textContent =
    '#demobalk{position:fixed;left:0;right:0;bottom:0;height:' + HOOG + 'px;' +
      'z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'gap:14px;padding:0 16px;background:#1c2230;color:#fff;' +
      'font:500 .84rem/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
      'box-shadow:0 -1px 0 rgba(20,28,44,.2)}' +
    '#demobalk b{font-weight:650;letter-spacing:-.01em}' +
    '#demobalk span{opacity:.72}' +
    '#demobalk button{font:inherit;font-weight:600;color:#fff;cursor:pointer;' +
      'background:rgba(255,255,255,.16);border:0;border-radius:999px;' +
      'padding:7px 13px;white-space:nowrap}' +
    '#demobalk button:hover{background:rgba(255,255,255,.26)}' +
    /* het bord is precies één scherm hoog; dat moet de strook meekrijgen */
    '.scherm{height:calc(100vh - ' + HOOG + 'px)}' +
    /* het beheer groeit mee met zijn inhoud en heeft een vaste zijbalk */
    '.app{min-height:calc(100vh - ' + HOOG + 'px)}' +
    '.zijbalk{height:calc(100vh - ' + HOOG + 'px)}' +
    'body{padding-bottom:' + HOOG + 'px;box-sizing:border-box}' +
    '@media (max-width:720px){#demobalk span{display:none}}' +
    '@media print{#demobalk{display:none}}';
  document.head.appendChild(stijl);

  var bar = document.createElement('div');
  bar.id = 'demobalk';
  var t = document.createElement('b'); t.textContent = 'Demo';
  bar.appendChild(t);
  var u = document.createElement('span');
  u.textContent = 'verzonnen kinderen, alles blijft in deze browser';
  bar.appendChild(u);

  var waar = /beheer\.html/.test(location.pathname) ? 'bord.html' : 'beheer.html';
  var naam = waar === 'bord.html' ? 'Naar het bord' : 'Naar het beheer';
  [[naam, function () { location.href = waar; }],
   ['Opnieuw beginnen', opnieuw],
   ['Demo verlaten', verlaten]].forEach(function (paar) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = paar[0];
    b.addEventListener('click', paar[1]);
    bar.appendChild(b);
  });
  document.body.appendChild(bar);
}

/* Eerst vullen, dan pas het bord laten beginnen -- daarom staat dit
   bestand in de pagina vóór kb-bord.js en kb-beheer.js.

   Kijken of de opslag leeg is moet vóór KB.laad(), want laad() maakt zelf
   al een lege groep aan als er niets staat. Daarna is "nog geen groepen"
   dus nooit meer waar, en vulde de demo zichzelf nooit. */
var nogNiets = true;
try { nogNiets = !localStorage.getItem('kb_demo_v5'); } catch (e) {}
KB.laad();
if (nogNiets) vullen();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', balk);
} else {
  balk();
}

global.KBDEMO = { opnieuw:opnieuw, verlaten:verlaten, vullen:vullen };

})(window);
