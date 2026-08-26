/* ══════════════════════════════════════════════════════════════════════
   TOT HET BREEKT
   De zware proef kijkt of een volle school werkt. Deze kijkt waar de
   grens ligt, en wat er gebeurt als je eroverheen gaat.

   Drie dingen:
     1. Opschalen tot de browseropslag vol is, en zien of de app dan
        afpelt in plaats van omvalt.
     2. De opslag met opzet dichtgooien en kijken of het werk van dat
        moment overleeft.
     3. Nagaan dat een groep die is uitgekleed nooit als "alles
        verwijderd" naar de server gaat.
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

const uit = [];
const zeg = (n, ok, extra) => {
  const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,130) + ']' : '');
  uit.push(r); console.log(r);
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const fouten = [];
  const c = await b.newContext({ viewport:{width:1500,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => fouten.push(e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon|fonts\.googleapis|ERR_|net::/.test(m.text()))
      fouten.push('[console] ' + m.text().slice(0,140));
  });

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => {
    localStorage.setItem('kb_server','http://localhost:5455');
    localStorage.setItem('kb_serversleutel','proefsleutel');
  });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','beheerder@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/school\.html/, { timeout: 25000 }).catch(()=>{});
  await p.waitForTimeout(3000);

  // ── 0. twee groepen echt vullen en opsturen ─────────────────────────
  const klaar = await p.evaluate(async () => {
    const namen = ['Groep 1A','Groep 1B'];
    const uit = [];
    for (const naam of namen) {
      const g = KB.G.klassen.filter(x => x.naam === naam)[0];
      await KBV.naarGroep(g.id);
      const k = KB.klas();
      k.leerlingen = ['Sem','Noor','Liam','Julia','Daan']
        .map((n,i)=>({ id:'l'+i, naam:n, kleur:'#3b6ff0' }));
      k.hoekLib = [{id:'bouw',naam:'Bouwhoek',maxKinderen:4},
                   {id:'huis',naam:'Huishoek',maxKinderen:4}];
      k.borden[0].hoekLibIds = ['bouw','huis'];
      KB.bewaar();
      await KBSYNC.duw(KBV.klasId(), KBV.groepId(), KBV.wie().profiel.school_id);
      uit.push(naam);
    }
    // terug naar de eerste; die maken we zo dadelijk veel te groot
    const eerste = KB.G.klassen.filter(x => x.naam === 'Groep 1A')[0];
    await KBV.naarGroep(eerste.id);
    return uit;
  });
  zeg('twee groepen staan echt op de server', klaar.length === 2, klaar.join(', '));

  // ── 1. opschalen tot het niet meer past ─────────────────────────────
  const groeien = await p.evaluate(async () => {
    const meting = [];
    const meet = () => {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i))||'').length;
      return Math.round(n / 1024);
    };
    /* Een foto van zo'n 22 KB, net als een verkleinde hoekfoto. */
    const c2 = document.createElement('canvas');
    c2.width = 800; c2.height = 610;
    const g = c2.getContext('2d');
    for (let i=0;i<600;i++){
      g.fillStyle = 'hsl(' + (i%360) + ',70%,55%)';
      g.fillRect(Math.random()*800, Math.random()*610, 30, 30);
    }
    const foto = c2.toDataURL('image/jpeg', 0.7);

    const k = KB.klas();
    let ronde = 0, gestopt = null, kapot = null;
    /* Blijven stapelen tot bewaar() het opgeeft of tot we het absurde
       voorbij zijn. Elke ronde: een hoek met foto, kinderen, en logboek. */
    while (ronde < 400) {
      ronde++;
      const i = ronde;
      const fotoId = 'fx' + i;
      k.fotoLib.push({ id:fotoId, naam:'Extra ' + i, data:foto, categorie:'hoekfoto' });
      k.hoekLib.push({ id:'hx' + i, naam:'Extra hoek ' + i, maxKinderen:4,
                       fotoId:fotoId, leerlingen:[] });
      for (let j = 0; j < 3; j++) {
        k.leerlingen.push({ id:'lx' + i + '_' + j, naam:'Kind ' + i + '.' + j,
                            kleur:'#3b6ff0' });
      }
      if (!k.gebeurtenissen) k.gebeurtenissen = [];
      for (let j = 0; j < 40; j++) {
        k.gebeurtenissen.push({ soort:'gekozen', tijd: Date.now() - j*1000,
                                leerlingId:'lx' + i + '_0', hoekId:'hx' + i });
      }
      let ok;
      try { ok = KB.bewaar(); }
      catch (e) { kapot = e.message; break; }
      if (!ok) { gestopt = ronde; break; }
      if (ronde % 20 === 0) meting.push({ ronde, kb: meet() });
    }
    return { rondes: ronde, gestopt, kapot, meting,
             kb: meet(), hoeken: k.hoekLib.length, kinderen: k.leerlingen.length,
             log: (k.gebeurtenissen||[]).length,
             krap: KB.opslagKrap() };
  });
  console.log('        gegroeid tot ' + groeien.hoeken + ' hoeken, ' +
              groeien.kinderen + ' kinderen, ' + groeien.log + ' logregels');
  console.log('        localStorage: ' + groeien.kb + ' KB');
  groeien.meting.forEach(m => console.log('          ronde ' + m.ronde + ': ' + m.kb + ' KB'));

  zeg('opstapelen laat de app niet crashen', !groeien.kapot, groeien.kapot || 'geen fout');
  /* Een kleutergroep heeft vijftien à twintig hoeken. Alles wat hier
     boven de veertig uitkomt is al twee keer een echte groep, en dat
     alles zonder ook maar één keer te versturen. */
  zeg('een groep past ruim twee keer een echte klas voordat het knelt',
      groeien.hoeken > 40, groeien.hoeken + ' hoeken met foto in één groep, ongesynchroniseerd');
  zeg('en als het niet meer past valt er niets om, maar weet de app het wel',
      groeien.gestopt !== null ? groeien.krap === true : true,
      groeien.gestopt ? 'gestopt bij ronde ' + groeien.gestopt + ', krap: ' + groeien.krap
                      : 'nooit geweigerd');

  // ── 2. de opslag met opzet dichtgooien ──────────────────────────────
  const dicht = await p.evaluate(() => {
    /* Een blok van een paar megabyte ernaast zetten, zodat er voor de
       app bijna niets overblijft. Zo simuleren we een apparaat waar ook
       nog andere dingen op staan. */
    let gelukt = 0;
    try {
      for (let i = 0; i < 40; i++) {
        localStorage.setItem('proef_vulling_' + i, 'x'.repeat(200000));
        gelukt++;
      }
    } catch (e) { /* vol, precies de bedoeling */ }

    const k = KB.klas();
    k.leerlingen.push({ id:'belangrijk', naam:'Nieuw kind van net', kleur:'#d94f4f' });
    const bewaardOk = KB.bewaar();
    /* staat het er ook echt? */
    let terug = null;
    try {
      const g = JSON.parse(localStorage.getItem('kb_v5') || '{}');
      const kk = (g.klassen||[]).filter(x => x.id === k.id)[0];
      terug = kk ? (kk.leerlingen||[]).some(l => l.id === 'belangrijk') : false;
    } catch (e) { terug = 'stuk: ' + e.message; }
    return { vulblokken: gelukt, bewaardOk, terug, krap: KB.opslagKrap() };
  });
  console.log('        vulling: ' + dicht.vulblokken + ' blokken van 200 KB ernaast gezet');
  zeg('de app weet dat het krap is en zegt dat ook', dicht.krap === true, String(dicht.krap));
  zeg('een volle opslag laat niets omvallen',
      dicht.terug === true || dicht.bewaardOk === false,
      'bewaar() gaf ' + dicht.bewaardOk + ', teruggelezen: ' + dicht.terug);

  // ── 2b. opruimen en kijken of het afpellen dan wél zijn werk doet ───
  const pellen = await p.evaluate(async () => {
    for (let i = 0; i < 40; i++) localStorage.removeItem('proef_vulling_' + i);
    const meet = () => {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i))||'').length;
      return Math.round(n / 1024);
    };
    const voor = meet();
    /* De foto's naar de kluis brengen, zoals na een gewone synchronisatie.
       Daarna hoort localStorage flink te slinken. */
    const k = KB.klas();
    await KBMEDIA.bewaarInKluis(k);
    return { voor, na: meet(),
             gemerkt: (k.fotoLib||[]).filter(f => f._c).length,
             totaal: (k.fotoLib||[]).length };
  });
  console.log('        na de foto’s naar de kluis: ' + pellen.voor + ' KB → ' + pellen.na + ' KB');
  zeg('foto’s naar de kluis brengen maakt localStorage flink leger',
      pellen.na < pellen.voor * 0.5, pellen.voor + ' KB → ' + pellen.na + ' KB');
  zeg('en ze staan allemaal als "ligt in de kluis" gemerkt',
      pellen.gemerkt === pellen.totaal, pellen.gemerkt + ' van ' + pellen.totaal);

  const nogHeelNaPellen = await p.evaluate(() => {
    const k = KB.klas();
    return { hoeken:(k.hoekLib||[]).length, kinderen:(k.leerlingen||[]).length,
             fotoTerug: (k.fotoLib||[]).filter(f => f.data).length };
  });
  zeg('in het geheugen staat alles nog gewoon compleet',
      nogHeelNaPellen.hoeken > 40 && nogHeelNaPellen.fotoTerug > 40,
      JSON.stringify(nogHeelNaPellen));

  // ── 3. een uitgeklede groep mag niet de server wissen ───────────────
  const grendel = await p.evaluate(async () => {
    const anders = KB.G.klassen.filter(x => x.id !== KB.G.activeKlasId)[0];
    if (!anders) return { over:'maar één groep' };
    anders.magOpnieuwOphalen = true;
    anders.leerlingen = []; anders.hoekLib = [];
    try {
      const uit = await KBSYNC.duw(anders.id, KBSYNC.opServer(anders.id),
                                   KBV.wie().profiel.school_id);
      return { geweigerd: !!(uit && uit.overgeslagen), reden: uit && uit.overgeslagen };
    } catch (e) {
      return { geweigerd:true, reden:e.message };
    }
  });
  zeg('een uitgeklede groep wordt niet opgestuurd',
      grendel.geweigerd === true, grendel.reden || grendel.over || 'ging wel door');

  const nogHeel = await p.evaluate(async () => {
    const anders = KB.G.klassen.filter(x => x.magOpnieuwOphalen)[0];
    if (!anders) return { over:'geen' };
    const gid = KBSYNC.opServer(anders.id);
    const l = await SB.lees('leerlingen', { kies:'id', waar:{ groep_id:'eq.' + gid } });
    return { opServer: l.length };
  });
  zeg('en de kinderen van die groep staan nog gewoon op de server',
      nogHeel.opServer > 0, nogHeel.opServer + ' kinderen');

  // ── 4. opruimen en kijken of het herstelt ───────────────────────────
  const herstel = await p.evaluate(async () => {
    const anders = KB.G.klassen.filter(x => x.magOpnieuwOphalen)[0];
    if (!anders) return { over:'geen' };
    try {
      await KBV.naarGroep(anders.id);
      const k = KB.klas();
      return { naam:k.naam, kinderen:(k.leerlingen||[]).length,
               hoeken:(k.hoekLib||[]).length, slotEraf: !k.magOpnieuwOphalen };
    } catch (e) { return { fout: e.message }; }
  });
  zeg('een uitgeklede groep openen haalt hem gewoon weer op',
      !herstel.fout && herstel.kinderen > 0 && herstel.slotEraf,
      herstel.fout || JSON.stringify(herstel));

  const stuk = [...new Set(fouten)];
  zeg('er viel nergens iets om', stuk.length === 0,
      stuk.slice(0,2).join(' | ') || 'geen enkele fout');
  if (stuk.length) stuk.slice(0,10).forEach(f => console.log('        ! ' + f));

  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
