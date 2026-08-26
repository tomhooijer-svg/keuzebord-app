/* ══════════════════════════════════════════════════════════════════════
   ELKE KNOP
   De andere proeven kijken of bepaalde dingen werken. Deze kijkt of er
   ergens een knop zit die niets doet.

   Voor elk scherm en elk paneel: alles wat je kunt aanklikken opzoeken,
   aanklikken, en nagaan of er daarna iets ánders is dan ervoor -- een
   venster dat opengaat, een melding, een scherm dat verandert, of
   gegevens die veranderen. Gebeurt er niets, dan staat die knop hier
   straks bij naam genoemd.

   Na elke klik zetten we de gegevens terug zoals ze waren, zodat de ene
   knop de volgende niet in de weg zit. Zo mag alles aangeklikt worden,
   ook "Verwijderen".
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

const uit = [];
const zeg = (n, ok, extra) => {
  const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,140) + ']' : '');
  uit.push(r); console.log(r);
};

/* Knoppen die het scherm verlaten klikken we niet aan -- dan is de proef
   voorbij. We kijken wel of ze bestaan en ergens aan hangen. */
const NIET_KLIKKEN = /Uitloggen|Wisselen van account|Bord openen|Afmelden/i;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1600,height:1100} });
  const p = await c.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon|fonts\.googleapis|ERR_|net::/.test(m.text()))
      fouten.push('[console] ' + m.text().slice(0,140));
  });

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','beheerder@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/school\.html/, { timeout: 25000 }).catch(()=>{});
  await p.waitForTimeout(3000);

  /* ── een groep om mee te werken, goed gevuld ──────────────────────── */
  await p.evaluate(async () => {
    const g = KB.G.klassen.filter(x => x.naam === 'Groep 1A')[0];
    await KBV.naarGroep(g.id);
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam','Julia','Daan','Mila']
      .map((n,i)=>({ id:'l'+i, naam:n, kleur:'#3b6ff0' }));
    k.hoekLib = [['Bouwhoek',4,false],['Huishoek',4,false],['Leeshoek',3,false],
                 ['Werkplaats',6,true]]
      .map(([n,pl,wp],i)=>({ id:'h'+i, naam:n, maxKinderen:pl, werkplaats:wp,
                             leerlijnen: KB.stelLeerlijnenVoor(n) }));
    k.borden[0].hoekLibIds = k.hoekLib.map(h=>h.id);
    k.borden[0].plaatsingen = {};
    k.hoekLib.forEach(h => { k.borden[0].plaatsingen[h.id] = []; });
    k.pictos = [{ id:'p0', naam:'Rondje', data:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }];

    const doelen = (KB.doelen.lijst || []).slice(0, 6);
    k.doelActief = {}; doelen.forEach(d => { k.doelActief[d.id] = true; });

    k.taken = [];
    const t1 = KB.nieuweTaak({ naam:'Knipwerk', omschrijving:'knippen en plakken', plekken:4 }, k);
    t1.doelIds = [doelen[0].id];
    KB.nieuweTaak({ naam:'Bouwen', omschrijving:'een toren maken', plekken:4 }, k);

    k.themas = [];
    const th = KB.nieuwThema({ naam:'De herfst', vraag:'Waarom vallen de blaadjes?' }, k);
    th.start = 'Een berg blaadjes in de kring.';
    th.afsluiting = 'We laten ons museum zien.';
    th.vragen = [{ id:'v1', tekst:'Waar gaan ze heen?', van:'kind', beantwoord:false },
                 { id:'v2', tekst:'Worden ze weer groen?', van:'kind', beantwoord:true }];
    th.activiteiten = [{ id:'a1', naam:'Blaadjes zoeken', soort:'buiten',
                         omschrijving:'met emmertjes', gedaan:false }];
    th.hoekIds = [k.hoekLib[0].id];
    th.doelIds = [doelen[1].id];
    t1.themaId = th.id;

    const ws = KB.weekSleutel();
    const w = KB.week(ws, k);
    w.themaId = th.id;
    w.centraleDoelIds = [doelen[0].id, doelen[1].id];
    KB.weekTaak(ws, t1.id, k);
    KB.verdeelAutomatisch(ws, t1.id, {}, k);

    k.beoordelingen = {};
    k.leerlingen.forEach((l,i) => KB.zetStand(l.id, doelen[0].id, KB.STANDEN[i%3], t1.id, k));

    const uur = 36e5, nu = Date.now(), log = [];
    for (let d = 1; d <= 8; d++) k.leerlingen.forEach((l,i) => {
      const h = k.hoekLib[(i+d) % k.hoekLib.length];
      const van = nu - d*24*uur + i*uur;
      log.push({ soort:'gekozen', tijd:van, leerlingId:l.id, hoekId:h.id });
      log.push({ soort:'weg', tijd:van + 25*60000, leerlingId:l.id, hoekId:h.id });
    });
    k.gebeurtenissen = log.sort((a,b)=>a.tijd-b.tijd);
    KB.bewaar();
  });
  await p.waitForTimeout(2500);

  /* ── het gereedschap dat elke knop langsloopt ─────────────────────────
     Na elke navigatie is de pagina leeg, dus dit zetten we er telkens
     opnieuw in. */
  const gereedschap = () => p.evaluate(() => {
    /* Alles wat een mens kan aanklikken. Niet alleen <button>: chips,
       kaartjes, schakelaars en rijen die als knop dienstdoen. */
    window.__klikbaar = function (waar){
      const wortel = waar || document;
      /* Wat is een knop? Alles waar een mens op zou klikken: een echte
         <button>, een link, een schakelaar, of iets waar de muisaanwijzer
         een handje van maakt. Vakjes die alleen iets laten zien -- de
         dagen in het weekplan bijvoorbeeld -- horen er niet bij: die
         hebben geen handje en zijn ook niet bedoeld om aan te klikken. */
      return [...wortel.querySelectorAll('*')].filter(function (e) {
        if (e.disabled || e.offsetParent === null) return false;
        /* Een gesloten venster staat er nog wel, maar vangt geen klik
           meer. Wat een mens niet kan indrukken, tellen wij niet mee. */
        if (getComputedStyle(e).pointerEvents === 'none') return false;
        // svg-iconen zijn geen knoppen; de knop eromheen wel
        if (!(e instanceof HTMLElement)) return false;
        if (e.tagName === 'BUTTON') return true;
        if (e.tagName === 'A' && e.getAttribute('href')) return true;
        if (e.getAttribute('role') === 'switch') return true;
        if (getComputedStyle(e).cursor !== 'pointer') return false;
        var ouder = e.closest('button');
        return !ouder || ouder === e;
      });
    };
    /* Een vingerafdruk van "hoe staat het er nu bij". Verandert die niet
       na een klik, dan deed die knop niets. */
    /* Een korte code voor een lap tekst. We vergeleken eerst alleen de
       lengte, en dan valt 4 -> 5 kinderen weg: even lang, dus "deed
       niets". Nu kijken we naar de inhoud zelf. */
    window.__code = function (t){
      let h = 5381;
      for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
      return h;
    };
    window.__afdruk = function (){
      const inhoud = document.getElementById('inhoud');
      const blad = document.getElementById('blad');
      const melding = document.getElementById('melding');
      return JSON.stringify({
        scherm: inhoud ? __code(inhoud.textContent) : 0,
        schermKop: inhoud ? (inhoud.querySelector('.titel')||{}).textContent : '',
        venster: document.getElementById('overlay')
                 ? document.getElementById('overlay').classList.contains('open') : false,
        vensterTekst: blad ? __code(blad.textContent) : 0,
        vensterWaarden: blad ? [...blad.querySelectorAll('input,select,textarea')]
                                 .map(x => x.value).join('|') : '',
        melding: melding ? melding.classList.contains('zichtbaar') : false,
        adres: location.hash,
        gegevens: __code(JSON.stringify(KB.G)),
        uiterlijk: (document.documentElement.getAttribute('style') || '') +
                   '|' + document.body.className +
                   '|' + getComputedStyle(document.body).backgroundColor,
        aanVinkjes: __code([].map.call(document.querySelectorAll('.aan'), function (e) {
          var plek = [].indexOf.call(e.parentNode ? e.parentNode.children : [], e);
          return e.tagName + '.' + e.className + '#' + plek +
                 ':' + (e.textContent || '').trim().slice(0, 18) +
                 ':' + (e.style ? e.style.background : '');
        }).join('|')),
        accountmenu: !!document.querySelector('.account.open'),
        menuKeuze: [...document.querySelectorAll('.zij-knop.aan')]
                     .map(x => x.textContent.trim()).join(',')
      });
    };
    /* Een knop die de bestandskiezer of het kleurenpalet van het
       apparaat opent, doet zijn werk -- maar dat venster hoort bij het
       besturingssysteem en staat niet in de pagina. We tellen daarom hoe
       vaak zo'n venster geopend wordt. */
    if (!window.__apparaathaak) {
      window.__apparaathaak = true;
      window.__apparaatvenster = 0;
      var isKiezer = function (e){
        return e && e.tagName === 'INPUT' && (e.type === 'file' || e.type === 'color');
      };
      document.addEventListener('click', function (e) {
        if (isKiezer(e.target)) window.__apparaatvenster++;
      }, true);
      var echteKlik = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (){
        if (isKiezer(this)) window.__apparaatvenster++;
        return echteKlik.apply(this, arguments);
      };
      if (HTMLInputElement.prototype.showPicker) {
        var echtePicker = HTMLInputElement.prototype.showPicker;
        HTMLInputElement.prototype.showPicker = function (){
          if (isKiezer(this)) window.__apparaatvenster++;
          return echtePicker.apply(this, arguments);
        };
      }
    }
    /* Vensters sluiten en het scherm opnieuw tekenen -- op elk van de
       drie pagina's heet dat anders, dus we pakken wat er is. */
    window.__sluitAlles = function (){
      var laag = document.getElementById('overlay');
      if (laag) laag.classList.remove('open');
    };
    window.__herteken = function (){
      if (window.BH && BH.teken) { BH.teken(); return; }
      if (window.SCH && SCH.teken) { SCH.teken(); return; }
      if (window.BORD && BORD.teken) BORD.teken();
    };
    /* Knoppen die het scherm verlaten drukken we niet in -- dan is de
       proef voorbij. */
    window.__nietKlikken = /Uitloggen|Wisselen van account|Bord openen|Afmelden/i;
    window.__noem = function (kn){
      return (kn.textContent || '').trim().slice(0, 44) ||
             kn.getAttribute('title') ||
             (typeof kn.className === 'string' ? kn.className : kn.tagName);
    };
    window.__klik = function (kn){
      if (typeof kn.click === 'function') kn.click();
      else kn.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true }));
    };
    window.__wacht = function (ms){ return new Promise(function (r){ setTimeout(r, ms); }); };
    window.__vensterOpen = function (){
      var o = document.getElementById('overlay');
      return !!(o && o.classList.contains('open'));
    };
    window.__bewaarStand = function (){ window.__stand = JSON.stringify(KB.G); };
    window.__zetTerug = function (){
      if (!window.__stand) return;
      const g = JSON.parse(window.__stand);
      KB.G.klassen = g.klassen;
      KB.G.activeKlasId = g.activeKlasId;
      KB.G.settings = g.settings;
    };
  });
  await gereedschap();

  /* Loopt één scherm af: alle knoppen, en welke niets deden. */
  async function veegScherm(naam, openScherm){
    const voorFouten = fouten.length;
    await openScherm();
    await p.waitForTimeout(900);

    const aantal = await p.evaluate(() => __klikbaar().length);
    const doden = [];
    const overgeslagen = [];
    const apparaat = [];
    let gedaan = 0;

    /* Eerst de knoppen van het paneel zelf, daarna die in de vensters die
       zij openen. Dat tweede rondje wordt onderweg gevuld. */
    const paden = [];
    for (let i = 0; i < aantal; i++) paden.push([i]);

    for (let n = 0; n < paden.length; n++) {
      const pad = paden[n];
      /* Een knop kan de pagina verlaten, ook als hij er niet naar heet.
         Dan is de proef niet stuk -- we gaan terug en lopen verder. */
      const adresVoor = p.url();
      let r;
      try {
        r = await p.evaluate(async (pad) => {
        /* Alles dicht en terug naar de kale toestand van dit scherm. */
        __sluitAlles();
        __zetTerug();
        __herteken();
        await __wacht(60);

        const lijst = __klikbaar();
        const kn = lijst[pad[0]];
        if (!kn) return { over:'weg' };
        const naam = __noem(kn);
        if (__nietKlikken.test(naam)) return { over:'zou het scherm verlaten', naam };

        if (pad.length === 1) {
          /* Klikken op wat al aanstaat -- het menu-item waar je staat, de
             stap die open is, de kleur die al gekozen is -- hoort niets te
             doen. Dat is geen kapotte knop. */
          if (kn.classList.contains('aan')) return { over:'staat al aan', naam };
          const voor = __afdruk();
          const vensterVoor = window.__apparaatvenster;
          try { __klik(kn); } catch (e) { return { naam, stuk: e.message }; }
          await __wacht(220);
          const na = __afdruk();
          const apparaat = window.__apparaatvenster > vensterVoor;
          /* Ging er een venster open? Dan hangen daar knoppen in die
             verder niemand indrukt. Hoeveel het er zijn geven we door;
             de proef komt er zo een voor een op terug. */
          const blad = document.getElementById('blad');
          return { naam, deedIets: apparaat || voor !== na, apparaat: apparaat,
                   vensterKnoppen: (__vensterOpen() && blad) ? __klikbaar(blad).length : 0 };
        }

        /* Twee stappen: eerst het venster openen, dan de knop daarbinnen. */
        try { __klik(kn); } catch (e) { return { over:'venster ging niet open', naam }; }
        await __wacht(280);
        const blad = document.getElementById('blad');
        if (!__vensterOpen() || !blad) return { over:'venster ging niet open', naam };
        const binnen = __klikbaar(blad);
        const kn2 = binnen[pad[1]];
        if (!kn2) return { over:'weg' };
        const naam2 = naam + ' \u2192 ' + __noem(kn2);
        if (__nietKlikken.test(__noem(kn2)))
          return { over:'zou het scherm verlaten', naam: naam2 };
        if (kn2.classList.contains('aan')) return { over:'staat al aan', naam: naam2 };
        const voor2 = __afdruk();
        const vensterVoor2 = window.__apparaatvenster;
        try { __klik(kn2); } catch (e) { return { naam: naam2, stuk: e.message }; }
        await __wacht(220);
        const na2 = __afdruk();
        const apparaat2 = window.__apparaatvenster > vensterVoor2;
        return { naam: naam2, deedIets: apparaat2 || voor2 !== na2, apparaat: apparaat2 };
        }, pad);
      } catch (e) {
        /* Context weg = de knop navigeerde. Dat telt als "deed iets". */
        if (/context was destroyed|Target closed|Execution context/i.test(e.message)) {
          await p.waitForTimeout(600);
          if (p.url() !== adresVoor) {
            await p.goto(adresVoor);
            await p.waitForTimeout(2500);
            await gereedschap();
            await p.evaluate(() => __bewaarStand());
            await openScherm();
            await p.waitForTimeout(700);
          }
          gedaan++;
          continue;
        }
        throw e;
      }

      if (p.url() !== adresVoor) {
        await p.goto(adresVoor);
        await p.waitForTimeout(2500);
        await gereedschap();
        await p.evaluate(() => __bewaarStand());
        await openScherm();
        await p.waitForTimeout(700);
        gedaan++;
        continue;
      }

      if (!r || r.over === 'weg') continue;
      if (r.over) { overgeslagen.push(r.naam); continue; }
      gedaan++;
      if (r.vensterKnoppen)
        for (let j = 0; j < r.vensterKnoppen; j++) paden.push([pad[0], j]);
      if (r.apparaat) apparaat.push(r.naam);
      if (r.stuk) doden.push(r.naam + ' (klapte eruit: ' + r.stuk + ')');
      else if (!r.deedIets) doden.push(r.naam);
    }

    await p.evaluate(() => {
      __sluitAlles();
      __zetTerug(); __herteken();
    }).catch(()=>{});

    const nieuweFouten = fouten.length - voorFouten;
    console.log('        ' + naam + ': ' + gedaan + ' knoppen, ' +
                doden.length + ' zonder effect' +
                (overgeslagen.length ? ', ' + overgeslagen.length + ' overgeslagen' : '') +
                (apparaat.length ? ', ' + apparaat.length + ' openen een venster van het apparaat' : '') +
                (nieuweFouten ? ', ' + nieuweFouten + ' fouten' : ''));
    doden.forEach(d => console.log('          ✗ ' + d));
    return { naam, gedaan, doden, apparaat, nieuweFouten };
  }

  /* ── het groepsbeheer, paneel voor paneel ─────────────────────────── */
  await p.goto(APP + '/beheer.html');
  await p.waitForTimeout(3000);
  await gereedschap();
  await p.evaluate(() => __bewaarStand());

  const menu = await p.evaluate(() =>
    [...document.querySelectorAll('.zij-knop')].map(x => x.textContent.trim()));
  zeg('het groepsbeheer heeft zijn menu', menu.length >= 12, menu.join(', '));

  const uitslagen = [];
  for (const naam of menu) {
    uitslagen.push(await veegScherm('beheer · ' + naam, async () => {
      await p.evaluate((n) => {
        const b2 = [...document.querySelectorAll('.zij-knop')]
          .filter(x => x.textContent.trim() === n)[0];
        if (b2) b2.click();
      }, naam);
    }));
  }

  /* ── het schoolbeheer ─────────────────────────────────────────────── */
  await p.goto(APP + '/school.html');
  await p.waitForTimeout(3000);
  await gereedschap();
  await p.evaluate(() => __bewaarStand());
  const schoolMenu = await p.evaluate(() =>
    [...document.querySelectorAll('.zij-knop')].map(x => x.textContent.trim()));
  for (const naam of schoolMenu) {
    uitslagen.push(await veegScherm('school · ' + naam, async () => {
      await p.evaluate((n) => {
        const b2 = [...document.querySelectorAll('.zij-knop')]
          .filter(x => x.textContent.trim() === n)[0];
        if (b2) b2.click();
      }, naam);
    }));
  }

  /* ── het bord ─────────────────────────────────────────────────────── */
  await p.goto(APP + '/bord.html');
  await p.waitForTimeout(3500);
  await gereedschap();
  await p.evaluate(() => {
    window.__bewaarStand();
    window.__afdruk = function (){
      return JSON.stringify({
        hoeken: document.querySelectorAll('.hoek').length,
        strook: document.querySelectorAll('.strook .picto').length,
        venster: document.getElementById('overlay').classList.contains('open'),
        vensterTekst: __code((document.getElementById('blad')||{}).textContent || ''),
        melding: document.getElementById('melding').classList.contains('zichtbaar'),
        pauze: getComputedStyle(document.getElementById('pauzevlak')).display,
        aanuit: (document.getElementById('knop-aanuit-tekst')||{}).textContent,
        gegevens: __code(JSON.stringify(KB.G)),
        uiterlijk: (document.documentElement.getAttribute('style') || '') +
                   '|' + document.body.className
      });
    };
  });
  const bordUit = await veegScherm('bord', async () => {});
  uitslagen.push(bordUit);

  // en het bordmenu apart, want die knoppen zitten in een venster
  await p.click('#knop-menu'); await p.waitForTimeout(700);
  const bordmenu = await p.evaluate(() => {
    const kn = [...document.querySelectorAll('#blad button')];
    return kn.map(x => x.textContent.trim());
  });
  zeg('het bordmenu heeft zijn knoppen', bordmenu.length >= 4, bordmenu.join(', '));
  await p.evaluate(() => __sluitAlles());

  /* ── de uitslag ───────────────────────────────────────────────────── */
  const totaal = uitslagen.reduce((n,u) => n + u.gedaan, 0);
  const dood = uitslagen.reduce((n,u) => n + u.doden.length, 0);
  const stuk = uitslagen.reduce((n,u) => n + u.nieuweFouten, 0);

  console.log('\n        ' + totaal + ' knoppen aangeklikt over ' + uitslagen.length + ' schermen');
  zeg('geen enkele knop klapte eruit', stuk === 0, stuk + ' fouten');
  zeg('elke knop doet iets', dood === 0,
      dood ? dood + ' zonder zichtbaar effect' : 'alle ' + totaal + ' knoppen');

  if (dood) {
    console.log('\n        knoppen zonder zichtbaar effect:');
    uitslagen.filter(u => u.doden.length).forEach(u => {
      console.log('          ' + u.naam + ':');
      u.doden.forEach(d => console.log('            ✗ ' + d));
    });
  }
  const uniek = [...new Set(fouten)];
  if (uniek.length) {
    console.log('\n        fouten onderweg:');
    uniek.slice(0,15).forEach(f => console.log('          ! ' + f));
  }

  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
