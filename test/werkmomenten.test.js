/* Twee werkmomenten op een hele dag, één op een halve. De tweede ronde
   staat grijs achter de eerste, en schuift naar voren zodra iemand zijn
   plaatje eruit haalt. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1600,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,95) + ']' : ''));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:14000}).catch(()=>{});
  await p.waitForTimeout(2200);

  // 18 kinderen, een werkplaats van 6, twee werkmomenten aan
  const opzet = await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = Array.from({length:18}, (_,i)=>({id:'l'+i, naam:'Kind '+(i+1), kleur:'#3b6ff0'}));
    k.hoekLib = [{ id:'wp', naam:'Werkplaats', maxKinderen:6, werkplaats:true },
                 { id:'h1', naam:'Bouwhoek', maxKinderen:4 }];
    k.borden[0].hoekLibIds = ['wp','h1'];
    k.settings.werkplaatsAan = true;
    k.settings.werkmomentenAan = true;
    k.taken = [{ id:'t0', naam:'Knipwerk', omschrijving:'', plekken:6, kleur:'#e79a1f',
                 doelIds:[], gemaakt:Date.now() }];
    const ws = KB.weekSleutel();
    KB.weekTaak(ws, 't0', k);
    const r = KB.verdeelAutomatisch(ws, 't0', {}, k);
    KB.bewaar();
    const w = KB.week(ws, k);
    const wt = w.taken[0];
    const per = {};
    KB.DAGEN_KORT.forEach(d => per[d] = (wt.verdeling[d]||[]).length);
    return { per, ruimte: KB.DAGEN_KORT.reduce((o,d)=>(o[d]=KB.dagRuimte(d,6,k),o),{}),
             niet: r.nietGeplaatst.length };
  });
  zeg('een hele dag heeft ruimte voor 12, een halve voor 6',
      opzet.ruimte.ma === 12 && opzet.ruimte.wo === 6, JSON.stringify(opzet.ruimte));
  zeg('alle 18 kinderen zijn ingedeeld', opzet.niet === 0, 'niet geplaatst: ' + opzet.niet);
  zeg('een hele dag krijgt er meer dan een halve',
      opzet.per.ma > opzet.per.wo, JSON.stringify(opzet.per));

  // Vandaag met opzet vol zetten: tien kinderen op één dag, zodat er echt
  // twee rondes zijn en we de grijze namen kunnen zien.
  await p.evaluate(() => {
    const k = KB.klas();
    const wt = KB.week(KB.weekSleutel(), k).taken[0];
    const dag = KB.dagVanVandaag();
    KB.DAGEN_KORT.forEach(d => { wt.verdeling[d] = []; });
    wt.verdeling[dag] = k.leerlingen.slice(0, 10).map(l => l.id);
    if (!k.settings.werkmomenten) k.settings.werkmomenten = KB.standaardWerkmomenten();
    k.settings.werkmomenten[dag] = 2;      // ook als het vandaag woensdag is
    KB.bewaar();
  });

  // de rondes op het bord
  await p.waitForTimeout(2600);
  await p.goto(APP + '/bord.html');
  await p.waitForTimeout(2600);
  const bordNu = await p.evaluate(() => {
    const kaart = [...document.querySelectorAll('.hoek')]
      .filter(h => /Werkplaats/.test(h.textContent))[0];
    return { gereserveerd: kaart.querySelectorAll('.plek.gereserveerd').length,
             straks: kaart.querySelectorAll('.plek.straks').length,
             namen: [...kaart.querySelectorAll('.plek.straks .plek-naam')].map(x=>x.textContent) };
  });
  await p.screenshot({ path:'/tmp/werkmomenten.png' });
  const dagVol = await p.evaluate(() => {
    const wt = KB.week(KB.weekSleutel()).taken[0];
    return (wt.verdeling[KB.dagVanVandaag()] || []).length;
  });
  zeg('de eerste ronde staat klaar in de werkplaats',
      bordNu.gereserveerd > 0, bordNu.gereserveerd + ' plekken gereserveerd, dag heeft ' + dagVol);
  zeg('zes plekken zijn voor de eerste ronde', bordNu.gereserveerd === 6, bordNu.gereserveerd);
  zeg('en de tweede ronde staat er niet grijs achter zolang de plekken vol zijn',
      bordNu.straks === 0, bordNu.straks + ' grijs');

  // een kind gaat erin en haalt zijn plaatje er weer uit
  const naWissel = await p.evaluate(async () => {
    const k = KB.klas();
    const wt = KB.week(KB.weekSleutel(), k).taken[0];
    const dag = KB.dagVanVandaag();
    const eerste = (wt.verdeling[dag] || [])[0];
    if (!eerste) return { overgeslagen: true };
    KB.plaats(eerste, 'wp');
    KB.haalWeg(eerste, 'wp');
    return { geweest: KB.geweestVandaag(wt, eerste), kind: eerste };
  });
  await p.reload(); await p.waitForTimeout(2600);
  await p.screenshot({ path:'/tmp/werkmomenten-na.png' });
  const naReload = await p.evaluate(() => {
    const kaart = [...document.querySelectorAll('.hoek')]
      .filter(h => /Werkplaats/.test(h.textContent))[0];
    return { gereserveerd: kaart.querySelectorAll('.plek.gereserveerd').length,
             straks: kaart.querySelectorAll('.plek.straks').length };
  });
  zeg('wie zijn plaatje eruit haalt is geweest',
      naWissel.overgeslagen || naWissel.geweest === true, JSON.stringify(naWissel));
  zeg('en dan schuift de volgende ronde in beeld',
      naReload.gereserveerd + naReload.straks >= 6 && naReload.straks > 0,
      'nu ' + naReload.gereserveerd + ' gereserveerd, ' + naReload.straks + ' grijs');

  // uitzetten
  const uitgezet = await p.evaluate(() => {
    const k = KB.klas();
    k.settings.werkmomentenAan = false;
    KB.bewaar();
    return KB.dagRuimte('ma', 6, k);
  });
  zeg('met de functie uit is er weer één ronde per dag', uitgezet === 6, 'ruimte maandag: ' + uitgezet);

  // aanpasbaar
  const eigen = await p.evaluate(() => {
    const k = KB.klas();
    k.settings.werkmomentenAan = true;
    k.settings.werkmomenten = { ma:3, di:2, wo:1, do:2, vr:1 };
    KB.bewaar();
    return { ma: KB.dagRuimte('ma', 6, k), vr: KB.dagRuimte('vr', 6, k) };
  });
  zeg('je kunt het aantal momenten zelf zetten',
      eigen.ma === 18 && eigen.vr === 6, JSON.stringify(eigen));

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
