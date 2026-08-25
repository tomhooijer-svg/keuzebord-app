/* Een taak maken zonder eerst doelen aan te vinken, doelen vinden via
   domein en leerlijn, en suggesties uit de omschrijving. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1440,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => {
    localStorage.setItem('kb_server','http://localhost:5455');
    localStorage.setItem('kb_serversleutel','proefsleutel');
  });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/, { timeout: 12000 }).catch(()=>{});
  await p.waitForTimeout(1800);

  // geen enkel doel aangevinkt voor deze groep
  const vooraf = await p.evaluate(() => Object.keys(KB.klas().doelActief || {}).length);
  zeg('deze groep heeft nog geen doelen aangevinkt', vooraf === 0, 'aangevinkt: ' + vooraf);

  // naar Taken en een taak maken
  await p.evaluate(() => {
    [...document.querySelectorAll('.zij-knop')].filter(b => /Taken/.test(b.textContent))[0].click();
  });
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter(x => /Taak (maken|toevoegen)|Nieuwe taak/.test(x.textContent))[0];
    if (b) b.click();
  });
  await p.waitForTimeout(600);
  const formulier = await p.evaluate(() => ({
    velden: [...document.querySelectorAll('#blad label')].map(x=>x.textContent),
    knoppen: [...document.querySelectorAll('#blad button')].map(x=>x.textContent)
  }));
  zeg('het taakformulier opent', formulier.velden.length >= 3, formulier.velden.join(' | '));
  zeg('doelen zijn niet verplicht', formulier.velden.some(x => /mag ook later/i.test(x)),
      formulier.velden.filter(x=>/[Dd]oel/.test(x)).join(' | '));

  // omschrijving typen → suggesties
  await p.fill('#blad input[type="text"]', 'Knipwerk herfstblad');
  await p.fill('#blad textarea', 'De kinderen knippen een blad uit en plakken het op een vel.');
  await p.waitForTimeout(1200);
  const tips = await p.evaluate(() => ({
    kop: (document.querySelector('#blad .tipkop')||{}).textContent || '',
    tips: [...document.querySelectorAll('#blad .doeltip .doeltip-zin')].map(x=>x.textContent)
  }));
  zeg('er komen suggesties bij de omschrijving', tips.tips.length > 0, tips.kop + ': ' + tips.tips.length);
  zeg('en "knippen" zit erbij', tips.tips.some(t => /knip/i.test(t)), tips.tips.join(' | ').slice(0,90));
  await p.screenshot({ path:'/tmp/doel-tips.png' });

  // een suggestie aantikken
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#blad .doeltip')]
      .filter(x => /knip/i.test(x.textContent))[0];
    if (t) t.click();
  });
  await p.waitForTimeout(500);
  const gekozen = await p.evaluate(() =>
    [...document.querySelectorAll('#blad .doelchip')].map(x=>x.textContent));
  zeg('één tik zet het doel bij de taak', gekozen.length === 1 && /knip/i.test(gekozen[0]),
      gekozen.join(' | ').slice(0,70));

  // de kiezer openen en bladeren
  await p.evaluate(() => {
    [...document.querySelectorAll('#blad button')].filter(x => x.textContent === 'Doelen zoeken')[0].click();
  });
  await p.waitForTimeout(700);
  const kiezer = await p.evaluate(() => ({
    domeinen: [...document.querySelectorAll('#blad .chips .chip')].map(x=>x.textContent),
    leerlijnen: [...document.querySelectorAll('#blad .leerlijnkop .leerlijnnaam')].map(x=>x.textContent)
  }));
  zeg('alle domeinen staan er, ook zonder aanvinken',
      kiezer.domeinen.some(x=>/Motoriek/.test(x)) && kiezer.domeinen.some(x=>/Rekenen/.test(x)),
      kiezer.domeinen.join(' | ').slice(0,90));

  // naar Motoriek → Fijne motoriek
  const domeinKlik = await p.evaluate(() => {
    const c = [...document.querySelectorAll('#blad .chips .chip')]
      .filter(x => /Motoriek/.test(x.textContent) && !/Alleen/.test(x.textContent))[0];
    if (!c) return 'geen chip: ' +
      [...document.querySelectorAll('#blad .chips .chip')].map(x=>x.textContent).join(' | ');
    c.click(); return 'ok';
  });
  if (domeinKlik !== 'ok') zeg('domein aanklikken', false, domeinKlik);
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const l = [...document.querySelectorAll('#blad .leerlijnkop')]
      .filter(x=>/Fijne motoriek/.test(x.textContent))[0];
    if (l) l.click();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path:'/tmp/doel-bladeren.png' });
  const fijn = await p.evaluate(() => ({
    lijnen: [...document.querySelectorAll('#blad .leerlijnkop .leerlijnnaam')].map(x=>x.textContent),
    doelen: [...document.querySelectorAll('#blad .leerlijninhoud .doelzin')].map(x=>x.textContent),
    niveaufilter: (document.querySelector('#blad .chips .chip')||{}).textContent
  }));
  zeg('Motoriek heeft fijne en grove motoriek',
      fijn.lijnen.includes('Fijne motoriek') && fijn.lijnen.includes('Grove motoriek'), fijn.lijnen.join(', '));
  zeg('en onder fijne motoriek staan de doelen', fijn.doelen.length > 3,
      fijn.doelen.length + ' doelen, o.a. ' + (fijn.doelen[0]||'').slice(0,40));
  zeg('waaronder knippen', fijn.doelen.some(d=>/knip/i.test(d)),
      (fijn.doelen.filter(d=>/knip/i.test(d))[0]||'niet gevonden').slice(0,50));
  zeg('Groep 1A krijgt de niveaus van groep 1', /1a|1b/.test(fijn.niveaufilter||''),
      fijn.niveaufilter);

  // zoeken
  await p.fill('#blad .doelbalk .invoer', 'vouwen');
  await p.waitForTimeout(600);
  const gezocht = await p.evaluate(() =>
    [...document.querySelectorAll('#blad .doelbladeraar .doelzin')].map(x=>x.textContent));
  zeg('zoeken op een woord werkt', gezocht.length > 0 && gezocht.every(x=>/vouw/i.test(x)),
      gezocht.length + ' treffers: ' + (gezocht[0]||'').slice(0,45));

  // opslaan zonder verdere doelen
  await p.evaluate(() => {
    [...document.querySelectorAll('#blad button')].filter(x=>x.textContent==='Klaar')[0].click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    [...document.querySelectorAll('#blad button')].filter(x=>x.textContent==='Opslaan')[0].click();
  });
  await p.waitForTimeout(1200);
  const opgeslagen = await p.evaluate(() => (KB.taken(KB.klas())||[]).map(t => ({
    naam: t.naam, doelen: (t.doelIds||[]).length })));
  zeg('de taak is opgeslagen', opgeslagen.length === 1 && opgeslagen[0].naam === 'Knipwerk herfstblad',
      JSON.stringify(opgeslagen));
  zeg('met het doel eraan', opgeslagen[0] && opgeslagen[0].doelen >= 1,
      'doelen: ' + (opgeslagen[0]||{}).doelen);

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
