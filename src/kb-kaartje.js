/* ══════════════════════════════════════════════════════════════
   HET INLOGKAARTJE
   Wat iemand in haar handen krijgt als er een account voor haar is
   gemaakt: haar naam, haar gebruikersnaam, haar wachtwoord en waar
   het bord en het beheer staan. Het wachtwoord wordt hier ook
   gemaakt -- dat en het kaartje zijn twee helften van hetzelfde:
   zonder het een heeft het ander geen zin.

   Het staat hier apart omdat twee schermen hetzelfde kaartje nodig
   hebben: het schoolbeheer maakt leerkrachten aan, het
   platformbeheer maakt schoolbeheerders aan. Twee kopieën zouden
   langzaam uit elkaar lopen -- en dan staat er op het ene kaartje
   wel een webadres en op het andere niet, precies op het moment dat
   iemand het nodig heeft.

   Dit bestand tekent alleen het kaartje. De knoppen eronder maakt
   elk scherm zelf, want vensters en meldingen werken daar anders.

   Eén ding dat hier niet gebeurt: het wachtwoord bewaren. Het staat
   op dit kaartje en nergens anders. Raakt iemand het kwijt, dan komt
   er een nieuw -- dat is veiliger dan een lijst met wachtwoorden die
   ergens blijft liggen.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

/* ── wachtwoorden die je kunt overtypen ───────────────────
   Een testleerkracht krijgt een kaartje in haar handen en typt het
   wachtwoord over op een digibord. Dan moet het te lezen zijn, te
   dicteren aan een collega, en toch niet te raden.

   Drie woorden en een cijfer: zandbak-tulp-regen-7. De woorden zijn
   kort, concreet en eenduidig gespeld, zodat niemand hoeft te raden
   of het nou "ij" of "ei" was.

   Hoe sterk is dat? Drie verschillende woorden uit honderdachtentwintig
   (128 x 127 x 126) maal acht cijfers: ruim zestien miljoen
   mogelijkheden. Dat klinkt veel en is het niet: een computer die
   ongestoord mag proberen, is daar zo doorheen. Wat het wél veilig
   maakt is dat niemand ongestoord mag proberen -- de pogingenrem hoort
   dus bij dit ontwerp en is geen extraatje. Wordt die rem ooit
   weggehaald, dan moeten deze wachtwoorden langer worden.
   Zie DECISIONS.md.

   De cijfers 0 en 1 zitten er niet in: op een kaartje zijn ze niet
   van de o en de l te onderscheiden. */
var WACHTWOORDEN = [
  'anker','appel','auto','bal','beer','berg','bezem','bloem','boek','boom',
  'boot','brief','brood','bril','broek','bus','dak','dans','deur','dier',
  'doos','draak','druif','duif','eend','egel','eiland','emmer','fiets','fluit',
  'gans','gitaar','glas','haai','haas','hamer','hand','hart','hoed','hond',
  'hout','huis','jas','kaars','kano','kaart','kast','kat','kikker','klok',
  'koek','koning','kraan','krant','kroon','kussen','lamp','leeuw','lepel','licht',
  'maan','mand','muis','muur','neus','noot','olifant','oven','paard','pan',
  'papier','parel','pen','piano','plant','poes','pot','puzzel','raam','raket',
  'regen','reus','ring','rivier','roos','schaap','schaar','schelp','schip','schoen',
  'sleutel','slot','sneeuw','ster','steen','stoel','strand','taart','tafel','tak',
  'tent','tijger','toren','trein','trommel','tuin','tulp','uil','vaas','veer',
  'vijver','vink','vis','vlag','vlieger','vogel','vork','vuur','wagen','wesp',
  'wiel','wind','wolk','worm','zand','zebra','zeil','zon'
];

/* Toeval dat niet te voorspellen is. Math.random is daar niet voor
   gemaakt: wie weet wanneer een account is aangemaakt, kan de reeks
   benaderen. crypto hoort hier dus, en als die er niet is maken we
   liever géén wachtwoord dan een zwakke. */
function toevalGetal(grens){
  var c = global.crypto || global.msCrypto;
  if (!c || !c.getRandomValues) throw new Error('Deze browser kan geen veilig toeval maken.');
  /* Niet zomaar modulo: de hoogste restjes komen dan vaker voor. We
     gooien het weg en pakken opnieuw, zodat elke uitkomst even vaak kan. */
  var max = Math.floor(0xFFFFFFFF / grens) * grens;
  var a = new Uint32Array(1);
  do { c.getRandomValues(a); } while (a[0] >= max);
  return a[0] % grens;
}

function wachtwoordVoorstel(){
  var woorden = [], gebruikt = {};
  while (woorden.length < 3) {
    var w = WACHTWOORDEN[toevalGetal(WACHTWOORDEN.length)];
    if (gebruikt[w]) continue;        // drie keer hetzelfde woord is geen drie woorden
    gebruikt[w] = true;
    woorden.push(w);
  }
  return woorden.join('-') + '-' + (toevalGetal(8) + 2);
}

function el(tag, klasse, tekst){
  var n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
}

/* Waar deze app staat, als volledig adres. Niet 'bord.html': dit gaat
   op papier mee naar huis, en daar is een pad zonder domein niets
   waard. Afgeleid van waar deze pagina zelf staat, zodat het klopt op
   GitHub Pages, op een eigen domein en op een testserver. */
function basisAdres(){
  return location.origin + location.pathname.replace(/[^/]*$/, '');
}

function rolNaam(rol){
  return rol === 'schoolbeheerder' ? 'Schoolbeheerder'
       : rol === 'platformbeheerder' ? 'Platformbeheerder'
       : 'Leerkracht';
}

/* Het kaartje als element. gegevens: naam, gebruikersnaam,
   wachtwoord, rol, school. */
function bouw(gegevens){
  var g = gegevens || {};
  var kaart = el('div', 'kaartje');

  var kop = el('div', 'kaartje-kop');
  var merk = el('img');
  merk.src = 'stijl/logo/ptje.svg';
  merk.alt = '';
  kop.appendChild(merk);
  var titel = el('div');
  titel.appendChild(el('div', 'n', 'Keuzebord'));
  var school = g.school || '';
  titel.appendChild(el('div', 's', school + (school ? ' · ' : '') + rolNaam(g.rol)));
  kop.appendChild(titel);
  kaart.appendChild(kop);

  [['Voor', g.naam || ''],
   ['Gebruikersnaam', g.gebruikersnaam || ''],
   ['Wachtwoord', g.wachtwoord || '']].forEach(function (paar) {
    var r = el('div', 'kaartje-regel');
    r.appendChild(el('div', 'l', paar[0]));
    r.appendChild(el('div', 'w', paar[1]));
    kaart.appendChild(r);
  });

  var basis = basisAdres();
  var voet = el('div', 'kaartje-voet');
  voet.appendChild(el('div', null, 'Het bord: ' + basis + 'bord.html'));
  voet.appendChild(el('div', null, 'Het beheer: ' + basis + 'beheer.html'));
  voet.appendChild(el('div', null, g.rol === 'schoolbeheerder'
    ? 'Wachtwoord kwijt? Neem contact op met de leverancier.'
    : 'Wachtwoord kwijt? Vraag je schoolbeheerder om een nieuw kaartje.'));
  kaart.appendChild(voet);

  return kaart;
}

/* Hetzelfde als tekst, om te plakken in een bericht. */
function tekst(gegevens){
  var g = gegevens || {}, basis = basisAdres();
  return [g.naam || '',
          'Gebruikersnaam: ' + (g.gebruikersnaam || ''),
          'Wachtwoord: ' + (g.wachtwoord || ''),
          'Bord: ' + basis + 'bord.html',
          'Beheer: ' + basis + 'beheer.html'].join('\n');
}

/* Naar het klembord, met een eerlijk antwoord of het gelukt is. Een
   browser mag dit weigeren (geen https, geen toestemming), en dan
   hoort er niet "gekopieerd" te staan terwijl het klembord leeg is. */
function kopieer(gegevens){
  var t = tekst(gegevens);
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    return Promise.reject(new Error('Kopiëren kan hier niet'));
  }
  return navigator.clipboard.writeText(t);
}

global.KBKAARTJE = { bouw: bouw, tekst: tekst, kopieer: kopieer,
                     basisAdres: basisAdres, rolNaam: rolNaam,
                     WACHTWOORDEN: WACHTWOORDEN, wachtwoord: wachtwoordVoorstel };

})(window);
