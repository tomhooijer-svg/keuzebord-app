/* De juf mag de timer overrulen.

   Staat de timer aan, dan zit een kind vast tot het rondje vol is. Dat
   is de bedoeling -- maar niet als het misgaat in de bouwhoek, als er
   iemand naar de logopedist moet, of als de kring eerder begint. Deze
   proef kijkt of de juf er dan langs kan, en of een kleuter dat niet
   kan. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

const uit = [];
const zeg = (n, ok, extra) => {
  const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,120) + ']' : '');
  uit.push(r); console.log(r);
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1500,height:1000} });
  const p = await c.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(2200);

  /* Drie kinderen in de bouwhoek, timer van tien minuten, net begonnen. */
  await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam'].map((n,i)=>({id:'l'+i,naam:n,kleur:'#3b6ff0'}));
    k.hoekLib = [{id:'bouw',naam:'Bouwhoek',maxKinderen:4},
                 {id:'huis',naam:'Huishoek',maxKinderen:4}];
    k.borden[0].hoekLibIds = ['bouw','huis'];
    k.settings.pinAan = false;
    k.settings.timerAan = true;
    k.settings.timerMinuten = 10;
    KB.bewaar();
  });
  await p.waitForTimeout(1500);
  await p.goto(APP + '/bord.html');
  await p.waitForTimeout(3000);
  /* Twee kinderen in de bouwhoek zetten doen we op het bord zelf: dat
     bord veegt zichzelf leeg als het van een vorige dag is, en dan zou
     een opzet vanuit het beheer meteen weer verdwijnen. */
  await p.evaluate(() => { KB.plaats('l0','bouw'); KB.plaats('l1','bouw'); });
  await p.reload();
  await p.waitForTimeout(2800);

  const vast = await p.evaluate(() => {
    const b2 = KB.bord();
    const pl = b2.plaatsingen.bouw.filter(x => x.leerlingId === 'l0')[0];
    return Math.round(KB.vergrendeldTot(pl, KB.hoekVan('bouw')) / 1000);
  });
  zeg('een kind dat net begonnen is zit vast', vast > 500 && vast <= 600, vast + ' seconden');

  /* ── de weg van de juf: het venster dat het kind te zien krijgt ──── */
  /* In de hoek staat het plaatje zonder naam eronder -- alleen de bol.
     We kijken dus naar wat er staat, niet naar de tekst erin. */
  const inDeHoek = await p.evaluate(() =>
    document.querySelectorAll('.hoek')[0].querySelectorAll('.picto').length);
  zeg('de twee kinderen staan in de bouwhoek', inDeHoek === 2, inDeHoek + ' plaatjes');

  // slepen met de muis: dat hoort niet te lukken en het venster hoort te komen
  const bron = await p.$('.hoek .picto');
  const doel = await p.$$('.hoek');
  if (bron && doel.length > 1) {
    const a = await bron.boundingBox(), z = await doel[1].boundingBox();
    if (a && z) {
      await p.mouse.move(a.x + a.width/2, a.y + a.height/2);
      await p.mouse.down();
      await p.mouse.move(z.x + z.width/2, z.y + z.height/2, { steps: 12 });
      await p.mouse.up();
      await p.waitForTimeout(700);
    }
  }
  const naSleep = await p.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    tekst: (document.getElementById('blad')||{}).textContent || '',
    nogInBouw: KB.bord().plaatsingen.bouw.some(x => x.leerlingId === 'l0')
  }));
  zeg('slepen lukt niet zolang de timer loopt', naSleep.nogInBouw === true);
  zeg('en het bord legt uit dat het nog even duurt',
      naSleep.open && /nog|duurt|rondje/i.test(naSleep.tekst), naSleep.tekst.slice(0,60));
  zeg('met daaronder de weg voor de juf',
      /Juf: toch eruit halen/.test(naSleep.tekst));

  /* ── zonder code gaat de juf er meteen langs ─────────────────────── */
  await p.evaluate(() => {
    [...document.querySelectorAll('#blad button')]
      .filter(x => /Juf: toch eruit halen/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(600);
  const keuze = await p.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    knoppen: [...document.querySelectorAll('#blad button')].map(x => x.textContent.trim())
  }));
  zeg('de juf krijgt drie mogelijkheden', keuze.open && keuze.knoppen.length === 3,
      keuze.knoppen.join(' | '));
  zeg('de timer afronden staat erbij',
      keuze.knoppen.some(t => /timer is klaar/i.test(t)));
  zeg('uit de hoek halen staat erbij',
      keuze.knoppen.some(t => /uit de hoek halen/i.test(t)));

  /* ── de timer afronden voor dit ene kind ─────────────────────────── */
  await p.evaluate(() => {
    [...document.querySelectorAll('#blad button')]
      .filter(x => /timer is klaar/i.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(700);
  const naVrij = await p.evaluate(() => {
    const b2 = KB.bord();
    const semP  = b2.plaatsingen.bouw.filter(x => x.leerlingId === 'l0')[0];
    const noorP = b2.plaatsingen.bouw.filter(x => x.leerlingId === 'l1')[0];
    return {
      sem:  KB.vergrendeldTot(semP,  KB.hoekVan('bouw')),
      noor: Math.round(KB.vergrendeldTot(noorP, KB.hoekVan('bouw')) / 1000),
      nogInBouw: !!semP,
      open: document.getElementById('overlay').classList.contains('open'),
      log: (KB.klas().gebeurtenissen || []).slice(-1)[0]
    };
  });
  zeg('Sem mag daarna wisselen', naVrij.sem === 0, naVrij.sem + ' ms');
  zeg('maar hij staat nog wel in de hoek', naVrij.nogInBouw === true);
  zeg('en de timer van Noor loopt gewoon door',
      naVrij.noor > 500 && naVrij.noor <= 600, naVrij.noor + ' seconden');
  zeg('het venster gaat dicht', naVrij.open === false);
  zeg('en het wordt in het logboek gezet',
      naVrij.log && naVrij.log.soort === 'vrijgegeven',
      naVrij.log ? naVrij.log.soort : 'geen');

  /* Nu mag hij ook echt weg: opnieuw slepen. */
  const bron2 = await p.$('.hoek .picto');
  const hoeken2 = await p.$$('.hoek');
  if (bron2 && hoeken2.length > 1) {
    const a = await bron2.boundingBox(), z = await hoeken2[1].boundingBox();
    if (a && z) {
      await p.mouse.move(a.x + a.width/2, a.y + a.height/2);
      await p.mouse.down();
      await p.mouse.move(z.x + z.width/2, z.y + z.height/2, { steps: 12 });
      await p.mouse.up();
      await p.waitForTimeout(900);
    }
  }
  const verhuisd = await p.evaluate(() =>
    KB.bord().plaatsingen.huis.some(x => x.leerlingId === 'l0'));
  zeg('en daarna verhuist hij wel naar de huishoek', verhuisd === true);

  /* ── uit de hoek halen via het hoekvenster ───────────────────────── */
  await p.evaluate(() => {
    const b2 = KB.bord();
    b2.plaatsingen.bouw = [{ leerlingId:'l1', startTijd: Date.now() }];
    b2.plaatsingen.huis = [];
    KB.bewaar();
  });
  await p.reload();
  await p.waitForTimeout(2600);
  await p.evaluate(() => {
    document.querySelectorAll('.hoek')[0].click();
  });
  await p.waitForTimeout(700);
  const hoekVenster = await p.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    plekken: document.querySelectorAll('#blad .detail-plek').length
  }));
  zeg('het hoekvenster laat de plekken zien', hoekVenster.open && hoekVenster.plekken > 0,
      hoekVenster.plekken + ' plekken');

  await p.evaluate(() => {
    const vak = [...document.querySelectorAll('#blad .detail-plek')]
      .filter(x => /Noor/.test(x.textContent))[0];
    if (vak) vak.click();
  });
  await p.waitForTimeout(700);
  const viaHoek = await p.evaluate(() =>
    [...document.querySelectorAll('#blad button')].map(x => x.textContent.trim()));
  zeg('een kind aantikken in het hoekvenster opent dezelfde keuze',
      viaHoek.some(t => /uit de hoek halen/i.test(t)), viaHoek.join(' | '));

  await p.evaluate(() => {
    [...document.querySelectorAll('#blad button')]
      .filter(x => /uit de hoek halen/i.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(800);
  const eruit = await p.evaluate(() => ({
    inBouw: KB.bord().plaatsingen.bouw.some(x => x.leerlingId === 'l1'),
    inStrook: [...document.querySelectorAll('.strook .picto')]
                .some(x => /Noor/.test(x.textContent || ''))
  }));
  zeg('uit de hoek halen haalt het kind eruit', eruit.inBouw === false);
  zeg('en zet hem terug in de strook', eruit.inStrook === true);

  /* ── met een code erop komt een kleuter er niet in ───────────────── */
  await p.evaluate(() => {
    const k = KB.klas();
    k.settings.pinAan = true; k.settings.pincode = '2468';
    KB.bord().plaatsingen.bouw = [{ leerlingId:'l0', startTijd: Date.now() }];
    KB.bewaar();
  });
  await p.reload();
  await p.waitForTimeout(2600);
  await p.evaluate(() => { document.querySelectorAll('.hoek')[0].click(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    const vak = [...document.querySelectorAll('#blad .detail-plek')]
      .filter(x => /Sem/.test(x.textContent))[0];
    if (vak) vak.click();
  });
  await p.waitForTimeout(700);
  const gevraagd = await p.evaluate(() => ({
    tekst: (document.getElementById('blad')||{}).textContent || ''
  }));
  zeg('met een code erop wordt eerst de code gevraagd',
      /code/i.test(gevraagd.tekst), gevraagd.tekst.slice(0,40));

  await p.evaluate(() => {
    '1111'.split('').forEach(ci => {
      const t = [...document.querySelectorAll('#blad .pintoets')]
        .filter(x => x.textContent === ci)[0];
      if (t) t.click();
    });
  });
  await p.waitForTimeout(700);
  const naFout = await p.evaluate(() => ({
    nogVast: KB.vergrendeldTot(
      KB.bord().plaatsingen.bouw.filter(x => x.leerlingId === 'l0')[0],
      KB.hoekVan('bouw')) > 0,
    tekst: (document.getElementById('blad')||{}).textContent || ''
  }));
  zeg('een verkeerde code laat de timer staan', naFout.nogVast === true);
  zeg('en de keuze van de juf komt niet in beeld',
      !/uit de hoek halen/i.test(naFout.tekst));

  await p.evaluate(() => {
    '2468'.split('').forEach(ci => {
      const t = [...document.querySelectorAll('#blad .pintoets')]
        .filter(x => x.textContent === ci)[0];
      if (t) t.click();
    });
  });
  await p.waitForTimeout(800);
  const naGoed = await p.evaluate(() =>
    [...document.querySelectorAll('#blad button')].map(x => x.textContent.trim()));
  zeg('met de goede code komt de keuze wel',
      naGoed.some(t => /uit de hoek halen/i.test(t)), naGoed.join(' | '));

  /* ── zonder timer heeft de ingreep geen betekenis maar breekt niets ─ */
  await p.evaluate(() => {
    const k = KB.klas();
    k.settings.pinAan = false; k.settings.timerAan = false;
    KB.bord().plaatsingen.bouw = [{ leerlingId:'l0', startTijd: Date.now() }];
    KB.bewaar();
  });
  await p.reload();
  await p.waitForTimeout(2600);
  await p.evaluate(() => { document.querySelectorAll('.hoek')[0].click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const vak = [...document.querySelectorAll('#blad .detail-plek')]
      .filter(x => /Sem/.test(x.textContent))[0];
    if (vak) vak.click();
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const kn = [...document.querySelectorAll('#blad button')]
      .filter(x => /uit de hoek halen/i.test(x.textContent))[0];
    if (kn) kn.click();
  });
  await p.waitForTimeout(700);
  const zonderTimer = await p.evaluate(() =>
    KB.bord().plaatsingen.bouw.some(x => x.leerlingId === 'l0'));
  zeg('zonder timer werkt uit de hoek halen ook gewoon', zonderTimer === false);

  zeg('er viel nergens iets om', fouten.length === 0,
      fouten.length ? fouten.slice(0,3).join(' | ') : 'geen enkele fout');

  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
